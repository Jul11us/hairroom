# GitHub 技术参考

核查日期：2026-10-15。建议先做手机和电脑网页，验证“选得出、像本人、能给理发师看”；再让 Chrome 插件复用同一网页组件和 API。桌面应用留给离线 GPU 或理发店固定设备场景。

## 模型选择

- **[HairFastGAN](https://github.com/AIRI-Institute/HairFastGAN)**：优先作为静态试戴基线。输入自拍、发型轮廓参考、发色参考，适合“看到喜欢的发型就试一下”。推理入口为 `main.py` / `HairFast(face, shape, color)`；官方要求 Linux、Python 3.10、NVIDIA CUDA。作者报告 V100 单张迁移不到一秒，不能据此认定连续视频稳定。代码 [MIT](https://github.com/AIRI-Institute/HairFastGAN/blob/main/LICENSE)，[官方权重库](https://huggingface.co/AIRI-Institute/HairFastGAN)也标 MIT；但[对齐代码](https://github.com/AIRI-Institute/HairFastGAN/blob/main/utils/shape_predictor.py)使用的 dlib 68 点模型存在[训练数据排除商用的说明](https://github.com/davisking/dlib/blob/master/python_examples/face_landmark_detection.py)，仍需核清或替换第三方权重。
- **[HairCLIP](https://github.com/wtybest/HairCLIP) / [HairCLIPv2](https://github.com/wtybest/HairCLIPv2)**：借鉴发型与发色分开控制，以及文字、参考图、蒙版、手绘刘海交互。两者均有代码和作者权重链接。v1 为 [LGPL-2.1](https://github.com/wtybest/HairCLIP/blob/main/LICENSE)，入口 `mapper/scripts/inference.py`；v2 当前未找到 LICENSE，不能假定允许复制商用。v2 用 CUDA/PyTorch 1.9，要求对齐的 1024×1024 人像，入口是 notebook；[默认反演和优化步骤](https://github.com/wtybest/HairCLIPv2/blob/main/utils/options.py)较多，先用于静态研究。
- **[Stable-Hair](https://github.com/Xiaojiu-z/Stable-Hair)**：作为画质对照。公开两阶段代码与权重链接，采用“去发→参考发型迁移”，入口 `infer_full.py` / Gradio，使用 CUDA 和 SD 1.5；[默认配置](https://github.com/Xiaojiu-z/Stable-Hair/blob/main/configs/hair_transfer.yaml)为 512×512、迁移 30 步。[代码 Apache-2.0](https://github.com/Xiaojiu-z/Stable-Hair/blob/main/LICENSE)不等于全部基座权重同许可。作者注明公开版主要训练于裁剪对齐脸，更强改进版未公开。

## 插件参考与接入

[Runway 官方 Try-On 插件](https://github.com/runwayml/try-on-chrome-extension)为 [MIT](https://github.com/runwayml/try-on-chrome-extension/blob/main/LICENSE)。[background.js](https://github.com/runwayml/try-on-chrome-extension/blob/main/background.js)实现图片右键菜单、打开 `sidePanel`、传入图片及生成状态；底层调用收费 Gen-4 服装试穿 API，是接口封装，不是发型模型。我们可借鉴“右键发型图→侧栏试戴”，并保留服务端密钥。

接入建议：保持现有 `/api/try-on`，另设常驻 Linux/CUDA Python 服务，先包装 HairFastGAN，建立少量已获许可的参考图，再比较保脸、发际线、遮挡、耗时和显存。

本轮仅文档、许可证、源码和权重目录核查；没有下载模型、运行推理、使用用户照片或验证摄像头实时效果。Google Drive 权重未下载核验；最低显存及本机适配尚未实测。

## 拖动编辑：让拖过的头发看起来是真的（2026-10-15 补充）

GitHub 上没有专门「拖头发」的项目；相关的是通用的「拖动式图像编辑」。按 [awesome-drag-editing](https://github.com/frakw/awesome-drag-editing) 的清单逐个核对仓库与许可：

- **[Inpaint4Drag](https://github.com/Visual-AI/Inpaint4Drag)**（ICCV 2025，[Apache-2.0](https://github.com/Visual-AI/Inpaint4Drag/blob/main/LICENSE)）：最贴合本项目。先把选中区域当弹性材料做双向变形（512×512 约 0.01 秒），再用修补模型补出露出来的区域（约 0.3 秒）。这正是我们浏览器里的做法加上一步生成式补图。[`utils/ui_utils.py`](https://github.com/Visual-AI/Inpaint4Drag/blob/main/utils/ui_utils.py) 用 diffusers 加载 `sd-legacy/stable-diffusion-inpainting`（可选 SDXL inpainting）+ LCM-LoRA + TAESD，fp16、CUDA。基座权重另有各自许可（SD 1.5 为 CreativeML OpenRAIL-M）。
- **[LightningDrag](https://github.com/magic-research/LightningDrag)**（Apache-2.0）：约 1 秒的通用拖动编辑，从视频学到的运动先验；最近更新 2024-10。
- **[RegionDrag](https://github.com/Visual-AI/RegionDrag)**（ECCV 2024）：约 1.5 秒，需要 CUDA；GitHub 未标注许可，不能假定可商用。
- **[InstantDrag](https://github.com/SNU-VGILab/InstantDrag)**：基础模型只用说话人脸视频训练，作者说明其他场景是实验性的；许可未声明。
- **[DragDiffusion](https://github.com/Yujun-Shi/DragDiffusion)**（Apache-2.0）：每次编辑在 A100 上约 20 秒、需约 14 GB 显存，太慢。
- **[DragGAN](https://github.com/XingangPan/DragGAN)**：算法代码 CC-BY-NC（不可商用），且只能编辑 GAN 能反演的图。

拉长、变形这类物理问题不需要模型：毛发模拟的标准做法是 Follow-The-Leader（Müller、Kim、Chentanez 2012，*Fast Simulation of Inextensible Hair and Fur*），从发根向外把每一节拉回原长。`src/lib/hair-physics.js` 已采用。

本机：NVIDIA GeForce RTX 5070 Ti Laptop GPU，12 GB 显存，可本地跑 SD 1.5 修补。RTX 50 系列需要支持 CUDA 12.8 的 PyTorch 版本。本轮未下载任何模型，也未运行推理。
