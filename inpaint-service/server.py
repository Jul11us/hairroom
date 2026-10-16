"""Hairroom local fill service.

Inpaint4Drag-style fill (Lu & Han, ICCV 2025, Apache-2.0): after the editor
moves hair, the area the hair uncovered is redrawn by Stable Diffusion 1.5
inpainting with the LCM-LoRA in 8 steps, then pasted back over only that area.

Runs on this PC's GPU and listens on 127.0.0.1 only. Photos stay on this PC.
Models come from ./models (run download_models.py once); nothing is
downloaded at run time.

    GET  /health -> {"ok": true, "loaded": bool, "device": str}
    POST /fill   {"image": data URL, "mask": data URL (white = redraw)}
              -> {"image": PNG data URL, "ms": int}
"""
import base64
import binascii
import io
import json
import os
import re
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
os.environ.setdefault("HF_HOME", os.path.join(HERE, "models"))
os.environ.setdefault("HF_HUB_OFFLINE", "1")

import numpy as np  # noqa: E402
import torch  # noqa: E402
from diffusers import AutoPipelineForInpainting, LCMScheduler  # noqa: E402
from PIL import Image, ImageFilter  # noqa: E402

MODEL = "stable-diffusion-v1-5/stable-diffusion-inpainting"
LCM_LORA = "latent-consistency/lcm-lora-sdv1-5"
HOST = "127.0.0.1"
PORT = int(os.environ.get("FILL_PORT", "4319"))
MAX_BODY = 24 * 1024 * 1024
MAX_SIDE = 4096
# Inpaint4Drag's settings for SD 1.5: long edge 512, 8 LCM steps, no guidance,
# full strength, empty prompt, mask grown by 5 px.
SIDE = 512
STEPS = 8
GROW = 5

_lock = threading.Lock()
_pipe = None


def pipeline():
    global _pipe
    if _pipe is None:
        pipe = AutoPipelineForInpainting.from_pretrained(
            MODEL,
            torch_dtype=torch.float16,
            variant="fp16",
            safety_checker=None,
            requires_safety_checker=False,
        )
        pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)
        pipe.load_lora_weights(LCM_LORA, weight_name="pytorch_lora_weights.safetensors")
        pipe.fuse_lora()
        pipe = pipe.to("cuda")
        pipe.set_progress_bar_config(disable=True)
        pipe.empty_prompt = pipe.encode_prompt("", "cuda", 1, False)[0]
        _pipe = pipe
    return _pipe


def decode(data_url):
    match = re.fullmatch(r"data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})", data_url or "")
    if not match:
        raise ValueError("expected a PNG, JPEG or WebP data URL")
    try:
        image = Image.open(io.BytesIO(base64.b64decode(match.group(2), validate=True)))
        image.load()
    except (binascii.Error, OSError) as error:
        raise ValueError("unreadable image") from error
    if max(image.size) > MAX_SIDE:
        raise ValueError("image too large")
    return image


def encode(image):
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def fill(image, mask):
    """Redraw the white part of `mask` in `image`; everything else is kept."""
    image = image.convert("RGB")
    mask = mask.convert("L").resize(image.size, Image.NEAREST)
    hole = np.array(mask) > 127
    ys, xs = np.nonzero(hole)
    if not len(xs):
        return image
    # Work on a crop around the hole with context on every side, scaled so its
    # long edge is 512: small holes get more detail, the face stays untouched.
    width, height = image.size
    span = max(xs.max() - xs.min(), ys.max() - ys.min()) + 1
    pad = max(48, int(span * 0.4))
    box = (
        max(0, int(xs.min()) - pad),
        max(0, int(ys.min()) - pad),
        min(width, int(xs.max()) + 1 + pad),
        min(height, int(ys.max()) + 1 + pad),
    )
    crop = image.crop(box)
    hole_mask = mask.crop(box).filter(ImageFilter.MaxFilter(GROW))
    scale = SIDE / max(crop.size)
    size = (max(8, round(crop.width * scale / 8) * 8), max(8, round(crop.height * scale / 8) * 8))
    pipe = pipeline()
    generator = torch.Generator("cuda").manual_seed(0)
    result = pipe(
        prompt_embeds=pipe.empty_prompt,
        image=crop.resize(size, Image.LANCZOS),
        mask_image=hole_mask.resize(size, Image.NEAREST),
        width=size[0],
        height=size[1],
        guidance_scale=1.0,
        num_inference_steps=STEPS,
        strength=1.0,
        generator=generator,
        output_type="pil",
    ).images[0].resize(crop.size, Image.LANCZOS)
    # Paste back only the hole, with a soft edge so no seam shows.
    blend = hole_mask.filter(ImageFilter.GaussianBlur(2))
    output = image.copy()
    output.paste(result, box[:2], blend)
    return output


class Handler(BaseHTTPRequestHandler):
    server_version = "HairroomFill/1"

    def log_message(self, *args):  # never log request contents
        pass

    def reply(self, status, body):
        content = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(content)

    def do_GET(self):
        if self.path != "/health":
            return self.reply(404, {"error": "not found"})
        self.reply(200, {
            "ok": torch.cuda.is_available(),
            "loaded": _pipe is not None,
            "device": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        })

    def do_POST(self):
        if self.path != "/fill":
            return self.reply(404, {"error": "not found"})
        # Only the Hairroom Node server calls this; browsers (which always send
        # Origin on cross-site POSTs) are turned away.
        if self.headers.get("Origin") or not (self.headers.get("Content-Type") or "").startswith("application/json"):
            return self.reply(403, {"error": "forbidden"})
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            return self.reply(413, {"error": "request too large"})
        try:
            body = json.loads(self.rfile.read(length))
            image = decode(body.get("image"))
            mask = decode(body.get("mask"))
        except (ValueError, AttributeError, json.JSONDecodeError):
            return self.reply(400, {"error": "invalid image or mask"})
        if not torch.cuda.is_available():
            return self.reply(503, {"error": "no CUDA GPU"})
        started = time.perf_counter()
        with _lock:
            output = fill(image, mask)
        self.reply(200, {"image": encode(output), "ms": round((time.perf_counter() - started) * 1000)})


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Hairroom fill service: http://{HOST}:{PORT} ({'CUDA' if torch.cuda.is_available() else 'no GPU'})")
    if os.environ.get("FILL_PRELOAD", "1") == "1" and torch.cuda.is_available():
        with _lock:
            pipeline()
        print("Model loaded.")
    server.serve_forever()
