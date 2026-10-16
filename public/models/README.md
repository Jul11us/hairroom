# Local hair segmentation assets

Hairroom uses Google's official MediaPipe HairSegmenter, fixed at model version 1. The model is 781,618 bytes (about 763 KiB). Inspection of its TFLite subgraph confirms a float32 `[1, 512, 512, 4]` input tensor (RGBA) and float32 `[1, 512, 512, 2]` output. MediaPipe handles canvas preprocessing. The binary includes `TFLITE_METADATA` and an associated `labels.txt` with `background` at category 0 and `hair` at category 1.

- [Official Image Segmenter documentation and model categories](https://ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter)
- [Official web API guide](https://ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter/web_js)
- [Pinned official model download](https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/1/hair_segmenter.tflite)
- [Official hair segmentation model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20-%20Hair%20Segmentation.pdf)

The SDK is `@mediapipe/tasks-vision` (Apache-2.0). Its runtime is copied from the installed package to `public/mediapipe/wasm`. If the npm package omits its license file (as version 1.1.1 does), the setup script obtains the hash-verified [official repository license and notices](https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE) instead and saves them alongside the runtime. The model comes from the official Google-hosted model endpoint above; consult its documentation and model card for model-specific terms and limitations. The SDK license is not a separate claim about every model weight.

After installing the npm dependencies, run:

```powershell
node scripts/setup-hair-model.mjs
```

The script can be run again safely. It verifies the pinned model's exact file size, TFLite identifier, embedded label text, and SHA-256, then copies Wasm files matching the installed SDK. It writes asset provenance, SDK version, sizes, and hashes to `manifest.json`. It refuses redirects and unexpected hosts, sizes, or hashes. It downloads only this small hair model.

Model SHA-256: `2628cf3ce5f695f604cbea2841e00befcaa3624bf80caf3664bef2656d59bf84`.

Segmentation fetches model and runtime files from this app's own origin. The photo stays in browser memory; it is not uploaded by the segmentation code. The singleton segmenter loads only when first requested, uses the CPU delegate for broad compatibility, and checks the model's label list before inference. Confidence masks are copied while the MediaPipe callback is valid and resampled to exactly match the input canvas.

The model is designed for a close-up selfie with one person. Lighting, hats, occlusion, dark backgrounds, and fine flyaway hair can cause errors. Users can correct the hair region by hand; automatic recognition failures produce an error instead of a fabricated mask. This model identifies hair pixels. It does not synthesize hidden hair, scalp, skin, or background after editing.
