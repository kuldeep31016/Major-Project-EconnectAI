"""Segmentation losses and metrics.

Metrics are accumulated as confusion counts over the whole split and reduced at
the end (so IoU/Dice are dataset-level, not batch-averaged).  Pixels equal to
``ignore_index`` are excluded everywhere.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import torch
import torch.nn as nn
import torch.nn.functional as F


# --------------------------------------------------------------------------- losses
class BCEDiceLoss(nn.Module):
    """Binary: BCE-with-logits + soft Dice, masked by ignore_index."""

    def __init__(self, ignore_index: int = 255, dice_weight: float = 1.0, pos_weight: float | None = None):
        super().__init__()
        self.ignore_index = ignore_index
        self.dice_weight = dice_weight
        self.pos_weight = pos_weight

    def forward(self, logits: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
        logits = logits[:, 0]
        valid = target != self.ignore_index
        t = torch.where(valid, target, torch.zeros_like(target)).float()
        pw = torch.tensor(self.pos_weight, device=logits.device) if self.pos_weight else None
        bce = F.binary_cross_entropy_with_logits(logits, t, reduction="none", pos_weight=pw)
        bce = (bce * valid).sum() / valid.sum().clamp(min=1)
        p = torch.sigmoid(logits) * valid
        inter = (p * t).sum()
        dice = 1 - (2 * inter + 1) / (p.sum() + t.sum() + 1)
        return bce + self.dice_weight * dice


class CEDiceLoss(nn.Module):
    """Multi-class: cross-entropy + mean soft Dice over classes."""

    def __init__(self, num_classes: int, ignore_index: int = 255, dice_weight: float = 1.0):
        super().__init__()
        self.c, self.ignore_index, self.dice_weight = num_classes, ignore_index, dice_weight

    def forward(self, logits: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
        ce = F.cross_entropy(logits, target, ignore_index=self.ignore_index)
        valid = (target != self.ignore_index).unsqueeze(1)
        t = F.one_hot(torch.where(valid[:, 0], target, 0), self.c).permute(0, 3, 1, 2).float() * valid
        p = torch.softmax(logits, 1) * valid
        inter = (p * t).sum((0, 2, 3))
        dice = 1 - ((2 * inter + 1) / (p.sum((0, 2, 3)) + t.sum((0, 2, 3)) + 1)).mean()
        return ce + self.dice_weight * dice


def build_loss(num_classes: int, ignore_index: int, name: str = "bce_dice", **kw) -> nn.Module:
    if num_classes == 1:
        if name in ("bce_dice", "bce+dice"):
            return BCEDiceLoss(ignore_index, **kw)
        if name == "bce":
            return BCEDiceLoss(ignore_index, dice_weight=0.0, **kw)
    else:
        if name in ("ce_dice", "ce+dice", "bce_dice"):
            return CEDiceLoss(num_classes, ignore_index, **kw)
        if name == "ce":
            return CEDiceLoss(num_classes, ignore_index, dice_weight=0.0)
    raise ValueError(f"unknown loss {name!r} for num_classes={num_classes}")


# --------------------------------------------------------------------------- metrics
@dataclass
class ConfusionAccumulator:
    num_classes: int
    ignore_index: int = 255
    threshold: float = 0.5
    matrix: torch.Tensor = field(default=None)

    def __post_init__(self):
        c = max(self.num_classes, 2)
        self.matrix = torch.zeros(c, c, dtype=torch.long)

    @torch.no_grad()
    def update(self, logits: torch.Tensor, target: torch.Tensor) -> None:
        if self.num_classes == 1:
            pred = (torch.sigmoid(logits[:, 0]) >= self.threshold).long()
        else:
            pred = logits.argmax(1)
        valid = target != self.ignore_index
        t = target[valid].long().cpu()
        p = pred[valid].cpu()
        c = self.matrix.shape[0]
        self.matrix += torch.bincount(t * c + p, minlength=c * c).reshape(c, c)

    def compute(self) -> dict:
        m = self.matrix.double()
        tp = m.diag()
        fp = m.sum(0) - tp
        fn = m.sum(1) - tp
        tn = m.sum() - tp - fp - fn
        eps = 1e-12
        iou = tp / (tp + fp + fn + eps)
        dice = 2 * tp / (2 * tp + fp + fn + eps)
        prec = tp / (tp + fp + eps)
        rec = tp / (tp + fn + eps)
        f1 = 2 * prec * rec / (prec + rec + eps)
        acc = tp.sum() / (m.sum() + eps)
        # Cohen's kappa
        pe = (m.sum(0) * m.sum(1)).sum() / (m.sum() ** 2 + eps)
        kappa = (acc - pe) / (1 - pe + eps)
        out = {
            "accuracy": float(acc), "kappa": float(kappa),
            "mean_iou": float(iou.mean()), "mean_dice": float(dice.mean()),
            "per_class": {
                str(k): {"iou": float(iou[k]), "dice": float(dice[k]), "precision": float(prec[k]),
                         "recall": float(rec[k]), "f1": float(f1[k]), "support": int(m.sum(1)[k])}
                for k in range(m.shape[0])
            },
            "confusion_matrix": self.matrix.tolist(),
            "n_pixels": int(m.sum()),
        }
        if self.num_classes == 1:  # headline = positive (habitat) class
            k = 1
            out.update({"iou": float(iou[k]), "dice": float(dice[k]), "precision": float(prec[k]),
                        "recall": float(rec[k]), "f1": float(f1[k]), "threshold": self.threshold})
        else:
            out.update({"iou": out["mean_iou"], "dice": out["mean_dice"],
                        "precision": float(prec.mean()), "recall": float(rec.mean()), "f1": float(f1.mean())})
        return out
