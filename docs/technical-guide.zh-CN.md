# Hairroom · 剪发前，先看见自己

这是一个本地运行的发型决策首版：上传照片、填写日常偏好、比较发型方向，并整理一张给理发师的沟通卡。它还不是实时摄像头或 Chrome 插件。

GitHub 参考项目、模型限制与网页 / 插件 / 桌面端取舍，见 [技术调研](github-references.md)。界面规范见 [DESIGN.md](../DESIGN.md)，示例图来源与完整生成提示词见 [ASSETS.md](../public/images/ASSETS.md)。

## 哪些功能已经接通

- **首页发型墙**：12 个格子男女交替，各自不停切换发型，同一时间不会出现重复的照片；点任意一格会放大，可左右翻看同性别的发型，有对应方案的可直接跳到工作室。照片池是 52 张 Unsplash 真人发型照（直接从 Unsplash 图片服务器加载，未下载进项目）加 8 张本项目的 AI 示例。真人照放大后显示摄影师署名并链接到 Unsplash 原图，AI 示例一律标注「AI 示例」。照片清单与署名见 `src/lib/hair-looks.js`。
- **偏好建议**：根据用户选择的长度、发质和打理习惯等信息，用本地规则排序发型方向。不是照片人脸分析，也不声称能客观选出“最适合”的发型。
- **示例体验**：用于演示流程的 AI 示例图片会明确标注。它们不是对用户照片的真实变换结果。
- **鼠标整理头发**：上传照片后点击「用鼠标整理我的头发」，也可直接整理 AI 示例。MediaPipe 在浏览器本机识别头发，再在头发上建一层发丝物理：发根靠近头顶、较稳，发梢松、会跟着甩动；同一缕头发保持长度，拖动时整缕绕发根转动而不是被拉长。工具有「梳理造型」（松手后保持）、「拨一拨」（松手后弹回并摆动）、局部蓬松与收拢，以及「微风吹动」预览。每一帧都从原照片取一次像素（WebGL2，不支持时用 CPU），反复拖动也不会越来越糊；脸和背景像素不会被移动。支持手绘选区、撤销/重做、按住对比、下载图片和把整理结果加入沟通卡。不需要图像 API key。拖动时像拿住一缕真头发：手上方的发丝从发根起弯成弧线，手下方的头发自然下垂、跟着手走；头发不会被拉长，往发根方向推会拱起而不是叠在一起。外层头发挪开后，露出的是稍暗、略虚的内层头发，挪到新位置的头发会在皮肤或背景上投下柔和的阴影，边缘的碎发跟着一起走。它仍是二维照片模拟：头发移开后露出的位置，先显示稍暗的下层头发，再显示由周围颜色推测的填充，不会真正生成被遮住的额头或背景。
- **真实照片试戴**：用户主动点击试戴后，将所选照片交给本地 Node 服务，再提交至 OpenAI Images 编辑接口。需要服务器配置 API key 和可用的图像模型权限。未配置时会明确提示，不会用假结果冒充成功。

图像模型可能改变发际线、局部遮挡或其他细节。效果图用于理发沟通，不能保证实际剪发效果。

## 本地启动

需要 Node.js 24 和 npm。

Windows 可双击 `启动Hairroom.cmd`，然后在浏览器打开终端中显示的地址。已有本地服务运行时直接访问即可，无需重复启动。

```powershell
npm install
npm run setup:hair
npm run dev
```

开发模式需要同时运行前端和 API 服务；如果 `npm run dev` 只启动 Vite，请在另一个终端运行：

```powershell
node server.mjs
```

API 默认监听 `http://127.0.0.1:4318`。前端的 `/api` 应代理到该地址，并保留请求 Host（Vite `changeOrigin: false`），以通过同源校验。

构建后可由 Node 服务直接提供 `dist`：

```powershell
npm run build
node server.mjs
```

然后打开 `http://127.0.0.1:4318`。

## 启用真实试戴

```powershell
Copy-Item .env.example .env
```

在 `.env` 中填入 `OPENAI_API_KEY`，重启 Node 服务。不要把 key 放在浏览器代码、`VITE_` 变量或公开仓库。示例配置默认模型为 `gpt-image-2`，可以通过 `OPENAI_IMAGE_MODEL` 修改。`PORT` 可以修改本地端口；更改后也要相应修改开发代理。

接口使用 `POST https://api.openai.com/v1/images/edits`，提交 multipart `image`、`model`、`prompt`、`n=1`、`size=auto`、`quality=medium`、`output_format=png`。根据 [OpenAI 官方 Images 编辑接口](https://developers.openai.com/api/reference/resources/images/methods/edit)和[图像生成说明](https://developers.openai.com/api/docs/guides/image-generation)，`gpt-image-2` 应省略 `input_fidelity`；该模型自动按高保真处理输入。实现已按官方文档核对，但本首版没有进行真实付费 API 调用；模型权限、计费、实际保真效果仍需用自己的账户验证。

## 本机 AI 补全（可选）

头发挪开后露出的地方（脖子、耳朵边、背景），浏览器只能按周围颜色猜。装好本机补全服务后，编辑器会在头发停下来时，把这一小块交给本机显卡重新画出来，再贴回原处；其他像素不变。做法参照 [Inpaint4Drag](https://github.com/Visual-AI/Inpaint4Drag)（ICCV 2025，Apache-2.0）：Stable Diffusion 1.5 inpainting + LCM-LoRA，8 步、长边 512。服务只监听 `127.0.0.1:4319`，照片不离开这台电脑。

需要 NVIDIA 显卡（RTX 50 系列要 CUDA 12.8 以上的 PyTorch；这里用 CUDA 13.0 版）。下载约 4 GiB：PyTorch 1.85 GiB、其余 Python 包约 54 MiB、模型 2.11 GiB（只下需要的 fp16 文件，不下 4 GB 原始权重和安全检查器）。

```powershell
cd inpaint-service
py -3.12 -m venv .venv
.venv\Scripts\python.exe -m pip install --no-cache-dir -r requirements.txt
.venv\Scripts\python.exe download_models.py
.venv\Scripts\python.exe server.py
```

`启动Hairroom.cmd` 检测到 `inpaint-service\.venv` 和 `inpaint-service\models` 后会自动启动它。它在一个最小化的「Hairroom AI 补全」窗口里运行，用的时候请保持这个窗口打开；如果服务出错退出，窗口会留着显示错误信息。Node 服务通过 `/api/fill` 转发（同源校验，一次一张），`/api/config` 的 `fillAvailable` 表示服务是否在线；编辑器里出现「AI 补全露出的地方」开关时即可使用，保存和下载的图片也包含补全结果。模型许可：SD 1.5 inpainting 为 CreativeML OpenRAIL-M，LCM-LoRA 为 openrail++。

## 照片和隐私

- 首页发型墙的真人照片由浏览器直接向 `images.unsplash.com` 请求，因此打开首页会访问 Unsplash；这不涉及用户自己的照片。离线或某张图加载失败时，该图会被跳过，墙面退回到其余照片和本地 AI 示例。
- 选择照片和填写偏好时，照片在当前页面内存中预览，不自动上传。
- 鼠标编辑仅在本机运行：头发模型和 Wasm 从本应用静态目录加载，识别和笔刷操作不上传照片。模型来源、版本、校验和与许可说明见 [本地模型说明](../public/models/README.md)。
- 只有主动触发真实试戴，照片及所选发型描述才会发送至本机 API 服务，并进一步发送给 OpenAI；这可能产生 API 费用。
- 本应用默认不将照片、生成图或 API key 写入照片数据库、日志文件或服务器磁盘；刷新或离开页面会清除页面中的照片状态。用户自行下载的沟通卡会保存在自己的设备。
- “本应用不落盘”不代表外部服务没有数据处理或保留规则。真实试戴使用前应根据实际发布场景说明外部服务的数据处理情况。

支持 JPG、PNG、WebP；原始照片上限为 8 MiB，且最多 4000 万像素、单边不超过 16384 像素。后端校验 MIME、base64、文件签名和图像容器尺寸，不进行完整像素解码。生产静态服务只读取 `dist` 内可公开的文件。

此服务仅用于本机首版，默认绑定 `127.0.0.1`，同源检查只接受本机 Host。不应直接暴露到公网；发布前需要完善账户、费用额度和访问控制。

## API 与验证

`GET /api/config` 返回 `{ tryOnAvailable: boolean, provider: 'openai' | null, fillAvailable: boolean }`，不会返回 key。

`POST /api/try-on` 接收：

```json
{
  "photo": "data:image/png;base64,...",
  "style": {
    "id": "soft-bob",
    "name": "轻盈波波头",
    "salonNotes": ["长度到下巴，保留自然发色"]
  }
}
```

成功返回 `{ "image": "data:image/png;base64,..." }`；失败返回 `{ "error": "中文错误提示" }`。POST 必须带与请求 Host 一致的 Origin。默认每个本机 IP 每分钟最多 3 次试戴，同时最多 1 个生成请求；生成超时为 120 秒。生成提示要求只改变头发，尽量保留五官、脸型、肤质、衣服、构图和背景。

```powershell
node --test tests/server.test.mjs
```

测试只使用本地 HTTP 和注入的 mock transport，覆盖成功、缺少 key、图片格式/大小、同源校验、限流、错误脱敏、超时和静态路径逃逸，不会产生真实图像 API 费用。

`server.mjs` 导出 `createAppServer(options)`，返回尚未监听的 Node `http.Server`，import 时不会加载 `.env` 或启动端口。可注入 `apiKey`、`model`、`fetchImpl`（与 `fetch` 相同的签名并返回标准 `Response`）、`timeoutMs`、`rateLimit`、`rateWindowMs`、`now`、`distDir`。正常运行 `node server.mjs` 时才加载项目 `.env`；已有环境变量优先。
