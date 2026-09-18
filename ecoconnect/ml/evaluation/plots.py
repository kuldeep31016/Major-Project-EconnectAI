"""Training/validation curves and qualitative prediction panels (image | ground truth | prediction | overlay)."""
from __future__ import annotations

import csv
from pathlib import Path

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402


def plot_history(history_csv: Path, out_dir: Path) -> None:
    rows = list(csv.DictReader(history_csv.open()))
    if not rows:
        return
    ep = [int(r["epoch"]) for r in rows]
    f = lambda k: [float(r[k]) for r in rows]  # noqa: E731

    fig, ax = plt.subplots(figsize=(6, 4))
    ax.plot(ep, f("train_loss"), label="train loss")
    ax.plot(ep, f("val_loss"), label="val loss")
    ax.set_xlabel("epoch"); ax.set_ylabel("loss"); ax.legend(); ax.grid(alpha=0.3)
    ax.set_title("Training curve")
    fig.tight_layout(); fig.savefig(out_dir / "training_curve.png", dpi=130); plt.close(fig)

    fig, ax = plt.subplots(figsize=(6, 4))
    for k, lab in (("val_iou", "IoU"), ("val_dice", "Dice"), ("val_precision", "Precision"), ("val_recall", "Recall")):
        ax.plot(ep, f(k), label=lab)
    ax.set_xlabel("epoch"); ax.set_ylim(0, 1); ax.legend(); ax.grid(alpha=0.3)
    ax.set_title("Validation metrics (habitat class)")
    fig.tight_layout(); fig.savefig(out_dir / "validation_curve.png", dpi=130); plt.close(fig)


def _to_rgb(img: np.ndarray, rgb_bands: tuple[int, int, int] | None) -> np.ndarray:
    """Stretch selected bands (or the first 1-3) to a displayable 0-1 RGB image."""
    c = img.shape[0]
    if rgb_bands is not None and max(rgb_bands) < c:
        x = img[list(rgb_bands)]
    elif c >= 3:
        x = img[:3]
    else:
        x = np.repeat(img[:1], 3, axis=0)
    x = x.astype(np.float32)
    lo, hi = np.percentile(x, 2), np.percentile(x, 98)
    x = np.clip((x - lo) / max(hi - lo, 1e-6), 0, 1)
    return np.transpose(x, (1, 2, 0))


def save_prediction_panel(img: np.ndarray, gt: np.ndarray, prob: np.ndarray, out_path: Path, *,
                          threshold: float, ignore_index: int = 255, title: str = "",
                          rgb_bands: tuple[int, int, int] | None = None) -> None:
    """4 panels: input | ground truth | predicted probability | binary prediction overlaid on input."""
    rgb = _to_rgb(img, rgb_bands)
    pred = prob >= threshold
    fig, axes = plt.subplots(1, 4, figsize=(14, 3.8))
    axes[0].imshow(rgb); axes[0].set_title("input")
    gt_show = np.ma.masked_where(gt == ignore_index, gt)
    axes[1].imshow(gt_show, cmap="Greens", vmin=0, vmax=1); axes[1].set_title("ground truth (weak label)")
    im = axes[2].imshow(prob, cmap="viridis", vmin=0, vmax=1); axes[2].set_title("P(habitat)")
    fig.colorbar(im, ax=axes[2], fraction=0.046)
    axes[3].imshow(rgb)
    overlay = np.zeros((*pred.shape, 4)); overlay[pred] = (0.0, 0.78, 0.59, 0.55)
    axes[3].imshow(overlay); axes[3].set_title(f"prediction >= {threshold}")
    for a in axes:
        a.axis("off")
    if title:
        fig.suptitle(title, fontsize=9)
    fig.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=110); plt.close(fig)


def plot_confusion(cm: list[list[int]], out_path: Path, labels=("non-habitat", "habitat")) -> None:
    m = np.asarray(cm, dtype=float)
    fig, ax = plt.subplots(figsize=(4, 3.6))
    ax.imshow(m / m.sum(1, keepdims=True).clip(min=1), cmap="Blues", vmin=0, vmax=1)
    for i in range(m.shape[0]):
        for j in range(m.shape[1]):
            ax.text(j, i, f"{int(m[i, j]):,}", ha="center", va="center", fontsize=8)
    ax.set_xticks(range(len(labels))); ax.set_yticks(range(len(labels)))
    ax.set_xticklabels(labels, rotation=20); ax.set_yticklabels(labels)
    ax.set_xlabel("predicted"); ax.set_ylabel("reference"); ax.set_title("Confusion matrix (pixels)")
    fig.tight_layout(); fig.savefig(out_path, dpi=130); plt.close(fig)
