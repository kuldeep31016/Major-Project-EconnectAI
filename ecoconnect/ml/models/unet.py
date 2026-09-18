"""Segmentation models  (paper Section IV-A, Fig. 3).

PRIMARY  - UNB7: U-Net decoder with an EfficientNet-B7 encoder and skip connections
           (the foundation study's architecture).  ``encoder = "efficientnet-b7"``.
DEV      - same U-Net decoder, EfficientNet-B0 encoder, for smoke runs on a laptop.
           This is a RESOURCE-DRIVEN configuration, not an architectural change; the
           encoder name is recorded in every checkpoint and metrics file.
ALT      - Swin-Transformer U-Net (paper: recorded alternative), via timm's Swin encoder
           inside the same decoder.  Not the baseline.

Implemented with segmentation_models_pytorch (smp), which provides exactly the
U-Net decoder + EfficientNet encoder combination with skip connections.
"""
from __future__ import annotations

import torch
import torch.nn as nn
import segmentation_models_pytorch as smp

ENCODER_ALIASES = {
    "unb7": "efficientnet-b7",
    "efficientnet-b7": "efficientnet-b7",
    "unb0": "efficientnet-b0",
    "efficientnet-b0": "efficientnet-b0",
    "efficientnet-b3": "efficientnet-b3",
    "swin-t": "tu-swin_tiny_patch4_window7_224",
    "swin-s": "tu-swin_small_patch4_window7_224",
}


def build_model(encoder: str, in_channels: int, num_classes: int, *, encoder_weights: str | None = "imagenet",
                decoder_channels=(256, 128, 64, 32, 16)) -> nn.Module:
    """U-Net(encoder) -> logits (B, num_classes, H, W).  num_classes == 1 -> binary (sigmoid)."""
    enc = ENCODER_ALIASES.get(encoder, encoder)
    kwargs = dict(encoder_name=enc, encoder_weights=encoder_weights, in_channels=in_channels,
                  classes=num_classes, decoder_channels=decoder_channels)
    if enc.startswith("tu-swin"):
        # swin encoders need fixed input size divisible by 32 and no reduction beyond stage 4
        kwargs.update(encoder_depth=4, decoder_channels=decoder_channels[:4])
    model = smp.Unet(**kwargs)
    model.eco_meta = {"architecture": "U-Net", "encoder": enc, "in_channels": in_channels,
                      "num_classes": num_classes, "encoder_weights": encoder_weights,
                      "paper_name": "UNB7" if enc == "efficientnet-b7" else f"U-Net/{enc} (dev or alt config)"}
    return model


def count_parameters(model: nn.Module) -> int:
    return sum(p.numel() for p in model.parameters())


def pick_device(pref: str = "auto") -> torch.device:
    if pref != "auto":
        return torch.device(pref)
    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")
