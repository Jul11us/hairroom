import { createHash } from 'node:crypto';
import { access, copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const modelDirectory = path.join(root, 'public', 'models');
const modelPath = path.join(modelDirectory, 'hair_segmenter.tflite');
const modelUrl = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/1/hair_segmenter.tflite';
const expectedBytes = 781618;
const expectedSha256 = '2628cf3ce5f695f604cbea2841e00befcaa3624bf80caf3664bef2656d59bf84';
const sdkDirectory = path.join(root, 'node_modules', '@mediapipe', 'tasks-vision');
const sourceWasmDirectory = path.join(sdkDirectory, 'wasm');
const targetWasmDirectory = path.join(root, 'public', 'mediapipe', 'wasm');
const licenseUrl = 'https://raw.githubusercontent.com/google-ai-edge/mediapipe/master/LICENSE';
const officialLicenseSha256 = '8707eef0533987efc5b155d64761eeb6e20793f50b9bd1a68dad1cf4719d0ed8';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function verifyModel(bytes) {
  if (bytes.length !== expectedBytes || sha256(bytes) !== expectedSha256
    || bytes.toString('ascii', 4, 8) !== 'TFL3') {
    throw new Error('官方头发模型完整性校验失败，未写入下载内容。');
  }
  // The model carries its two labels as an uncompressed associated ZIP file.
  if (!bytes.includes(Buffer.from('labels.txtbackground\nhair\n'))) {
    throw new Error('模型没有预期的 background / hair 标签。');
  }
}

async function downloadModel() {
  const url = new URL(modelUrl);
  if (url.protocol !== 'https:' || url.hostname !== 'storage.googleapis.com'
    || url.pathname !== '/mediapipe-models/image_segmenter/hair_segmenter/float32/1/hair_segmenter.tflite') {
    throw new Error('只允许下载固定的官方 HTTPS 模型。');
  }
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`官方模型下载失败：HTTP ${response.status}`);
  const declaredSize = Number(response.headers.get('content-length'));
  if (declaredSize && declaredSize !== expectedBytes) {
    throw new Error('官方模型文件大小发生变化，停止下载。');
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.length;
    if (total > expectedBytes) throw new Error('模型超过预期大小，停止下载。');
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  verifyModel(bytes);
  await writeFile(modelPath, bytes);
  return bytes;
}

async function prepareLicense() {
  const target = path.join(targetWasmDirectory, 'LICENSE');
  let contents;
  let source;
  try {
    contents = await readFile(path.join(sdkDirectory, 'LICENSE'));
    source = '@mediapipe/tasks-vision/LICENSE';
  } catch {
    // The 1.1.1 npm tarball declares Apache-2.0 but omits a LICENSE file.
    // Preserve the official repository's license and notices verbatim instead.
    source = licenseUrl;
    try {
      contents = await readFile(target);
      if (sha256(contents) !== officialLicenseSha256) contents = undefined;
    } catch { /* Fetch the official license on the first setup. */ }
    if (!contents) {
      const url = new URL(licenseUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'raw.githubusercontent.com'
        || url.pathname !== '/google-ai-edge/mediapipe/master/LICENSE') {
        throw new Error('只允许读取官方 MediaPipe 许可证。');
      }
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`官方许可证下载失败：HTTP ${response.status}`);
      contents = Buffer.from(await response.arrayBuffer());
      if (contents.length !== 12331 || sha256(contents) !== officialLicenseSha256) {
        throw new Error('官方许可证完整性校验失败。');
      }
    }
  }
  await writeFile(target, contents);
  return { path: 'mediapipe/wasm/LICENSE', source, bytes: contents.length, sha256: sha256(contents) };
}

async function main() {
  try {
    await access(sourceWasmDirectory);
  } catch {
    throw new Error('请先安装项目依赖（npm install），再运行此脚本。');
  }
  const sdk = JSON.parse(await readFile(path.join(sdkDirectory, 'package.json'), 'utf8'));
  await mkdir(modelDirectory, { recursive: true });
  await mkdir(targetWasmDirectory, { recursive: true });
  let model;
  try {
    model = await readFile(modelPath);
    verifyModel(model);
    console.log('头发模型已存在，SHA-256 校验通过。');
  } catch {
    model = await downloadModel();
    console.log('已下载并校验官方头发模型。');
  }
  const wasmFiles = [];
  for (const entry of (await readdir(sourceWasmDirectory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isFile() || !/\.(?:js|wasm)$/.test(entry.name)) continue;
    await copyFile(path.join(sourceWasmDirectory, entry.name), path.join(targetWasmDirectory, entry.name));
    const contents = await readFile(path.join(targetWasmDirectory, entry.name));
    wasmFiles.push({ path: `mediapipe/wasm/${entry.name}`, bytes: contents.length, sha256: sha256(contents) });
  }
  if (!wasmFiles.some((file) => file.path.endsWith('.wasm'))) throw new Error('SDK 中没有可用的 Wasm 文件。');
  const licenseFile = await prepareLicense();
  const manifest = {
    schemaVersion: 1,
    model: {
      name: 'MediaPipe HairSegmenter',
      source: modelUrl,
      documentation: 'https://ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter',
      path: 'models/hair_segmenter.tflite',
      bytes: model.length,
      sha256: sha256(model),
      // Read from this pinned model's TFLite subgraph, not inferred from docs.
      input: [1, 512, 512, 4],
      output: [1, 512, 512, 2],
      tensorType: 'float32',
      labels: ['background', 'hair'],
    },
    runtime: { package: '@mediapipe/tasks-vision', version: sdk.version, license: sdk.license, licenseFile, files: wasmFiles },
  };
  await writeFile(path.join(modelDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`模型 ${model.length} bytes；SDK ${sdk.version}；已复制 ${wasmFiles.length} 个运行时文件。`);
  console.log(`SHA-256 ${manifest.model.sha256}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
