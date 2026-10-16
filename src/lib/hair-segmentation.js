// The SDK, Wasm runtime, model, and inference all run in this browser.
// Only same-origin static assets are fetched; image pixels are never sent away.
let segmenterPromise;

const HAIR_CATEGORY = 1;
const MODEL_PATH = '/models/hair_segmenter.tflite';
const WASM_PATH = '/mediapipe/wasm';

async function getSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
      const segmenter = await ImageSegmenter.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'CPU' },
        runningMode: 'IMAGE',
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      });
      // Both the official model documentation and its embedded labels.txt say:
      // 0 = background, 1 = hair. Refuse an accidentally substituted model.
      const labels = segmenter.getLabels();
      if (labels.length !== 2 || labels[HAIR_CATEGORY]?.trim().toLowerCase() !== 'hair') {
        segmenter.close();
        throw new Error('头发模型的类别不匹配。');
      }
      return segmenter;
    })().catch((cause) => {
      // A subsequent attempt can recover after static assets become available.
      segmenterPromise = undefined;
      throw new Error('本地头发识别暂时不可用，请手动涂出头发区域，或稍后重试。', { cause });
    });
  }
  return segmenterPromise;
}

function resizeConfidence(source, sourceWidth, sourceHeight, width, height) {
  if (sourceWidth === width && sourceHeight === height) return new Float32Array(source);
  const mask = new Float32Array(width * height);
  // Resample confidence values directly instead of quantizing them through RGBA.
  for (let y = 0; y < height; y += 1) {
    const sy = Math.max(0, Math.min(sourceHeight - 1, (y + 0.5) * sourceHeight / height - 0.5));
    const y0 = Math.floor(sy);
    const y1 = Math.min(sourceHeight - 1, y0 + 1);
    const fy = sy - y0;
    for (let x = 0; x < width; x += 1) {
      const sx = Math.max(0, Math.min(sourceWidth - 1, (x + 0.5) * sourceWidth / width - 0.5));
      const x0 = Math.floor(sx);
      const x1 = Math.min(sourceWidth - 1, x0 + 1);
      const fx = sx - x0;
      const top = source[y0 * sourceWidth + x0] * (1 - fx) + source[y0 * sourceWidth + x1] * fx;
      const bottom = source[y1 * sourceWidth + x0] * (1 - fx) + source[y1 * sourceWidth + x1] * fx;
      mask[y * width + x] = top * (1 - fy) + bottom * fy;
    }
  }
  return mask;
}

/**
 * Find hair in a canvas without uploading the image.
 * coverage is the fraction of pixels whose hair confidence is at least 0.5.
 * The returned mask owns its memory and always matches the input canvas size.
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<{mask: Float32Array, width: number, height: number, coverage: number}>}
 */
export async function segmentHair(canvas) {
  const width = canvas?.width;
  const height = canvas?.height;
  if (!canvas || typeof canvas.getContext !== 'function' || !Number.isInteger(width)
    || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error('请先加载一张完整的照片，再识别头发。');
  }
  const segmenter = await getSegmenter();
  if (canvas.width !== width || canvas.height !== height) {
    throw new Error('照片已变化，请重新识别头发。');
  }
  let output;
  try {
    // Callback masks belong to MediaPipe and expire when this callback ends.
    // Copy/resample inside the callback so no Wasm-backed data escapes it.
    segmenter.segment(canvas, (result) => {
      const hair = result.confidenceMasks?.[HAIR_CATEGORY];
      if (!hair || !hair.width || !hair.height) {
        throw new Error('头发模型没有返回有效区域。');
      }
      const source = hair.getAsFloat32Array();
      if (source.length !== hair.width * hair.height) {
        throw new Error('头发识别结果尺寸异常。');
      }
      for (let i = 0; i < source.length; i += 1) {
        if (!Number.isFinite(source[i]) || source[i] < 0 || source[i] > 1) {
          throw new Error('头发识别结果无效。');
        }
      }
      const mask = resizeConfidence(source, hair.width, hair.height, width, height);
      let selected = 0;
      for (let i = 0; i < mask.length; i += 1) {
        if (mask[i] >= 0.5) selected += 1;
      }
      output = { mask, width, height, coverage: selected / mask.length };
    });
  } catch (cause) {
    throw new Error('这张照片暂时无法自动识别头发，请手动涂出头发区域。', { cause });
  }
  if (!output || output.coverage < 0.0001) {
    throw new Error('没有识别到清晰的头发，请手动涂出区域，或换一张光线清晰的单人照片。');
  }
  return output;
}
