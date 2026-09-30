"""Re-export: the candidate rule lives in the core package so reports and the API share it."""
from ecoconnect.pipeline.restoration_rules import (  # noqa: F401
    CATEGORY_LABEL, UNCERTAIN_FRACTION, UNCERTAIN_MIN_HA, UNCERTAIN_NOTE, annotate, classify,
)
