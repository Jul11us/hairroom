"""Download only the model files the fill service needs into ./models.

Skips the 4 GB original checkpoint, the fp32 weights and the safety checker.
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
os.environ.setdefault("HF_HOME", os.path.join(HERE, "models"))

from huggingface_hub import snapshot_download  # noqa: E402

# Commits downloaded and tested on 2026-10-15.
REVISIONS = {
    "stable-diffusion-v1-5/stable-diffusion-inpainting": "8a4288a76071f7280aedbdb3253bdb9e9d5d84bb",
    "latent-consistency/lcm-lora-sdv1-5": "cf2fced511dbe7e26c8d1d397e728fbab875db4b",
}

DOWNLOADS = {
    # CreativeML OpenRAIL-M
    "stable-diffusion-v1-5/stable-diffusion-inpainting": [
        "model_index.json",
        "unet/config.json",
        "unet/diffusion_pytorch_model.fp16.safetensors",
        "text_encoder/config.json",
        "text_encoder/model.fp16.safetensors",
        "vae/config.json",
        "vae/diffusion_pytorch_model.fp16.safetensors",
        "tokenizer/*",
        "scheduler/*",
        "feature_extractor/*",
    ],
    # openrail++: lets the inpainting model finish in 8 steps
    "latent-consistency/lcm-lora-sdv1-5": ["pytorch_lora_weights.safetensors"],
}

if __name__ == "__main__":
    for repo, patterns in DOWNLOADS.items():
        path = snapshot_download(repo, revision=REVISIONS[repo], allow_patterns=patterns)
        print(f"{repo} -> {path}")
