# Training

```bash
python scripts/train.py --config configs/train_dev.yaml            # MODE A: laptop, subset, B0 encoder
python scripts/train.py --config configs/train_full.yaml           # MODE B: GPU, UNB7 (EfficientNet-B7)
python scripts/train.py --config configs/train_dev.yaml --smoke    # 2 epochs × 3 batches plumbing check
python scripts/train.py --config ... --resume outputs/segmentation/<exp>/last_model.pth
```

No Python edits are needed to change any parameter: everything is in `configs/train_*.yaml` and
`configs/dataset.yaml`, and any leaf can be overridden with `ECO_<SECTION>__<KEY>=…`.

## Model (paper §IV-A, Fig. 3)

`ecoconnect/ml/models/unet.py` builds a **U-Net decoder with skip connections on an EfficientNet encoder** via
`segmentation_models_pytorch`. `encoder: efficientnet-b7` is **UNB7**, the foundation study's architecture and
the configured primary model (`train_full.yaml`). `encoder: efficientnet-b0` (`train_dev.yaml`) is a
**resource-driven development configuration**: identical decoder and skips, shallower encoder, 6.3 M vs
67.1 M parameters. The encoder name is written into every checkpoint, `metrics.json` and `experiments.csv`.
A Swin-Transformer encoder (`swin-t`) is available as the paper's recorded alternative; it is not the baseline.

Measured on this machine (Apple M3, 16 GB, MPS): B7 forward+backward at batch 2 × 256² runs (~2.4 s/step), so
UNB7 *can* be trained locally at small batch, but a full run belongs on a CUDA GPU (Colab/Kaggle). AMP is
enabled automatically on CUDA only.

## Loop (`ecoconnect/ml/training/trainer.py`)

AdamW · cosine or plateau LR schedule · BCE+Dice (binary) or CE+Dice (multi-class) with `ignore_index` masking ·
gradient clipping · early stopping on the validation monitor (`iou` by default) · best + last checkpoints ·
seeded (`torch`, `numpy`, `random`, DataLoader generator) · per-epoch CSV history · PNG curves.

## Outputs — `outputs/segmentation/<experiment_id>/`

```
config.yaml           exact resolved config (+ mode, experiment id)
experiment.json       id, timestamp, mode, result_label, dataset (name, root, splits sizes, bands, normaliser),
                      model (encoder, params), batch size, lr, epochs, seed, loss, scheduler, AMP, hardware,
                      training_time_s, best_epoch, status
history.csv           epoch, train_loss, val_loss, val_iou, val_dice, val_precision, val_recall, val_f1, val_accuracy, lr, epoch_time_s
metrics.json          best-epoch validation metrics; test metrics added by evaluate.py
best_model.pth / last_model.pth
training_curve.png / validation_curve.png
```
and one row per experiment in `outputs/segmentation/experiments.csv` (simple experiment tracking, no external service).

## Cloud mode (Colab / Kaggle)

1. Clone the repo, `pip install -r requirements.txt`.
2. Mount Drive / attach the dataset; `export DATA_ROOT=/content/drive/MyDrive/ecoconnect_data`.
3. `python scripts/train.py --config configs/train_full.yaml`.
4. Copy `outputs/segmentation/<exp>/` back (best_model.pth is ~270 MB for B7).

## Labelling of results

`mode: development` → **DEVELOPMENT-SUBSET RESULT — NOT FINAL**; `mode: full` → **OUR EXPERIMENTAL RESULT**.
Labels against GMW measure agreement with a weak label, not ground truth. Until a run completes, EcoConnectAI's
segmentation accuracy is **NOT AVAILABLE**; 95.56 % OA is the foundation study's (PUBLISHED BASELINE).
