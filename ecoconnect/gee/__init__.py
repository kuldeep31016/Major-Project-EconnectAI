"""Satellite acquisition: credential-free STAC path (default) and optional Google Earth Engine path."""
from .stac_acquire import AOI, TargetGrid, stac_search, sentinel1_composite, sentinel2_composite, write_scene
from .gmw_labels import gmw_labels_for_grid, gmw_tile_names
