"""Training loop with checkpointing, early stopping, mixed precision (CUDA), CSV/JSON logging.

Every experiment writes to outputs/segmentation/<experiment_id>/:
    config.yaml            the exact resolved configuration
    experiment.json        id, timestamp, mode, dataset, split sizes, model, hardware, timing, best epoch
    history.csv            per-epoch train loss / val loss / val metrics / lr / time
    metrics.json           best-epoch validation metrics (+ test metrics after evaluate.py)
    best_model.pth         best checkpoint (by val monitor)
    last_model.pth         last epoch
    training_curve.png, validation_curve.png
"""
from __future__ import annotations

import csv
import json
import math
import platform
import random
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch
import yaml
from torch.utils.data import DataLoader

from ecoconnect import __version__
from ecoconnect.ml.evaluation.metrics import ConfusionAccumulator, build_loss
from ecoconnect.ml.models.unet import build_model, count_parameters, pick_device

RESULT_LABEL = {
    "development": "DEVELOPMENT-SUBSET RESULT - NOT FINAL",
    "full": "OUR EXPERIMENTAL RESULT",
}


def seed_everything(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def _hardware(device: torch.device) -> dict:
    info = {"device": str(device), "platform": platform.platform(), "machine": platform.machine(),
            "torch": torch.__version__, "python": platform.python_version()}
    if device.type == "cuda":
        info["gpu"] = torch.cuda.get_device_name(0)
        info["gpu_memory_gb"] = round(torch.cuda.get_device_properties(0).total_memory / 1e9, 1)
    return info


@torch.no_grad()
def run_eval(model, loader: DataLoader, loss_fn, device, num_classes: int, ignore_index: int,
             threshold: float = 0.5) -> tuple[float, dict]:
    model.eval()
    acc = ConfusionAccumulator(num_classes, ignore_index, threshold)
    tot, n = 0.0, 0
    for x, y, _ in loader:
        x, y = x.to(device), y.to(device)
        logits = model(x)
        tot += float(loss_fn(logits, y.long() if num_classes > 1 else y)) * x.shape[0]
        n += x.shape[0]
        acc.update(logits, y)
    return tot / max(n, 1), acc.compute()


def train(cfg: dict, loaders: dict[str, DataLoader], dataset_info: dict, *, mode: str,
          out_root: Path, experiment_id: str | None = None, resume: Path | None = None) -> Path:
    tcfg, mcfg = cfg["training"], cfg["model"]
    seed_everything(tcfg["seed"])
    device = pick_device(tcfg.get("device", "auto"))
    exp_id = experiment_id or f"{mcfg['encoder']}_{mode}_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"
    out = out_root / exp_id
    out.mkdir(parents=True, exist_ok=True)
    (out / "config.yaml").write_text(yaml.safe_dump({**cfg, "mode": mode, "experiment_id": exp_id}, sort_keys=False))

    num_classes, ignore = dataset_info["num_classes"], dataset_info["ignore_index"]
    model = build_model(mcfg["encoder"], dataset_info["in_channels"], num_classes,
                        encoder_weights=mcfg.get("encoder_weights")).to(device)
    loss_fn = build_loss(num_classes, ignore, tcfg.get("loss", "bce_dice"), **tcfg.get("loss_kwargs", {}))
    opt = torch.optim.AdamW(model.parameters(), lr=tcfg["learning_rate"], weight_decay=tcfg.get("weight_decay", 1e-4))
    sched_name = tcfg.get("scheduler", "cosine")
    if sched_name == "cosine":
        sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=tcfg["epochs"], eta_min=tcfg["learning_rate"] * 0.01)
    elif sched_name == "plateau":
        sched = torch.optim.lr_scheduler.ReduceLROnPlateau(opt, mode="max", factor=0.5, patience=3)
    else:
        sched = None
    use_amp = bool(tcfg.get("mixed_precision", True)) and device.type == "cuda"
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)

    start_epoch, best_val, best_epoch, bad_epochs = 1, -math.inf, 0, 0
    monitor = tcfg.get("monitor", "iou")
    if resume and Path(resume).exists():
        ck = torch.load(resume, map_location=device, weights_only=False)
        model.load_state_dict(ck["model"])
        opt.load_state_dict(ck["optimizer"])
        start_epoch, best_val, best_epoch = ck["epoch"] + 1, ck.get("best_val", -math.inf), ck.get("best_epoch", 0)

    hist_path = out / "history.csv"
    hist_cols = ["epoch", "train_loss", "val_loss", "val_iou", "val_dice", "val_precision", "val_recall", "val_f1",
                 "val_accuracy", "lr", "epoch_time_s"]
    if not hist_path.exists():
        with hist_path.open("w", newline="") as f:
            csv.writer(f).writerow(hist_cols)

    exp = {
        "experiment_id": exp_id, "timestamp_utc": datetime.now(timezone.utc).isoformat(), "mode": mode,
        "result_label": RESULT_LABEL[mode], "ecoconnect_version": __version__,
        "dataset": dataset_info, "model": model.eco_meta, "parameters": count_parameters(model),
        "batch_size": loaders["train"].batch_size, "learning_rate": tcfg["learning_rate"], "epochs_planned": tcfg["epochs"],
        "seed": tcfg["seed"], "loss": tcfg.get("loss", "bce_dice"), "scheduler": sched_name,
        "mixed_precision": use_amp, "hardware": _hardware(device), "status": "running",
    }
    (out / "experiment.json").write_text(json.dumps(exp, indent=1))
    print(f"[train] {exp_id}  mode={mode}  {RESULT_LABEL[mode]}")
    print(f"[train] model={model.eco_meta['paper_name']}  params={exp['parameters']/1e6:.1f}M  device={device}  amp={use_amp}")
    print(f"[train] train={len(loaders['train'].dataset)} val={len(loaders['val'].dataset)} test={len(loaders['test'].dataset)} tiles")

    t_start = time.time()
    max_batches = tcfg.get("max_train_batches_per_epoch")   # smoke-test knob
    for epoch in range(start_epoch, tcfg["epochs"] + 1):
        model.train()
        t0, tot, n = time.time(), 0.0, 0
        for bi, (x, y, _) in enumerate(loaders["train"]):
            if max_batches and bi >= max_batches:
                break
            x, y = x.to(device), y.to(device)
            opt.zero_grad(set_to_none=True)
            with torch.autocast(device_type="cuda", enabled=use_amp):
                logits = model(x)
                loss = loss_fn(logits, y.long() if num_classes > 1 else y)
            scaler.scale(loss).backward()
            if tcfg.get("grad_clip"):
                scaler.unscale_(opt)
                torch.nn.utils.clip_grad_norm_(model.parameters(), tcfg["grad_clip"])
            scaler.step(opt)
            scaler.update()
            tot += float(loss.detach()) * x.shape[0]
            n += x.shape[0]
        train_loss = tot / max(n, 1)
        val_loss, vm = run_eval(model, loaders["val"], loss_fn, device, num_classes, ignore, tcfg.get("threshold", 0.5))
        if sched is not None:
            sched.step(vm[monitor]) if sched_name == "plateau" else sched.step()
        lr = opt.param_groups[0]["lr"]
        dt = time.time() - t0
        with hist_path.open("a", newline="") as f:
            csv.writer(f).writerow([epoch, f"{train_loss:.6f}", f"{val_loss:.6f}", f"{vm['iou']:.6f}", f"{vm['dice']:.6f}",
                                    f"{vm['precision']:.6f}", f"{vm['recall']:.6f}", f"{vm['f1']:.6f}",
                                    f"{vm['accuracy']:.6f}", f"{lr:.3e}", f"{dt:.1f}"])
        print(f"[epoch {epoch:3d}/{tcfg['epochs']}] train_loss={train_loss:.4f} val_loss={val_loss:.4f} "
              f"IoU={vm['iou']:.4f} Dice={vm['dice']:.4f} P={vm['precision']:.4f} R={vm['recall']:.4f} lr={lr:.2e} ({dt:.0f}s)")

        state = {"model": model.state_dict(), "optimizer": opt.state_dict(), "epoch": epoch,
                 "best_val": best_val, "best_epoch": best_epoch, "eco_meta": model.eco_meta,
                 "dataset": dataset_info, "config": cfg, "experiment_id": exp_id, "mode": mode}
        torch.save(state, out / "last_model.pth")
        if vm[monitor] > best_val:
            best_val, best_epoch, bad_epochs = vm[monitor], epoch, 0
            state["best_val"], state["best_epoch"] = best_val, best_epoch
            torch.save(state, out / "best_model.pth")
            (out / "metrics.json").write_text(json.dumps({
                "experiment_id": exp_id, "mode": mode, "result_label": RESULT_LABEL[mode],
                "model": model.eco_meta["paper_name"], "encoder": model.eco_meta["encoder"],
                "best_epoch": best_epoch, "monitor": monitor, "val": vm, "val_loss": val_loss,
                "test": None, "note": "val = best-epoch validation metrics; test filled by scripts/evaluate.py",
            }, indent=1))
        else:
            bad_epochs += 1
            if tcfg.get("early_stopping_patience") and bad_epochs >= tcfg["early_stopping_patience"]:
                print(f"[train] early stopping at epoch {epoch} (no {monitor} improvement for {bad_epochs} epochs)")
                break

    exp.update({"status": "completed", "training_time_s": round(time.time() - t_start, 1),
                "best_epoch": best_epoch, f"best_val_{monitor}": best_val, "epochs_run": epoch})
    (out / "experiment.json").write_text(json.dumps(exp, indent=1))
    try:
        from ecoconnect.ml.evaluation.plots import plot_history
        plot_history(hist_path, out)
    except Exception as e:  # plotting must never kill a run
        print(f"[train] plotting skipped: {e}")
    _append_registry(out_root, exp, vm)
    print(f"[train] done. best {monitor}={best_val:.4f} at epoch {best_epoch}. outputs: {out}")
    return out


def _append_registry(out_root: Path, exp: dict, last_val: dict) -> None:
    """Append one row to outputs/segmentation/experiments.csv (simple experiment tracking)."""
    p = out_root / "experiments.csv"
    cols = ["experiment_id", "timestamp", "mode", "result_label", "dataset", "train_tiles", "val_tiles", "test_tiles",
            "model", "encoder", "batch_size", "learning_rate", "epochs_run", "seed", "device", "training_time_s",
            "best_epoch", "val_iou", "val_dice", "val_precision", "val_recall", "val_f1"]
    new = not p.exists()
    with p.open("a", newline="") as f:
        w = csv.writer(f)
        if new:
            w.writerow(cols)
        d = exp["dataset"]
        w.writerow([exp["experiment_id"], exp["timestamp_utc"], exp["mode"], exp["result_label"], d.get("name"),
                    d.get("n_train"), d.get("n_val"), d.get("n_test"), exp["model"]["paper_name"], exp["model"]["encoder"],
                    exp["batch_size"], exp["learning_rate"], exp.get("epochs_run"), exp["seed"], exp["hardware"]["device"],
                    exp.get("training_time_s"), exp.get("best_epoch"),
                    *(f"{last_val[k]:.4f}" for k in ("iou", "dice", "precision", "recall", "f1"))])
