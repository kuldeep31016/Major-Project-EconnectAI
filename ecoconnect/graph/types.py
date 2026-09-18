"""Core data types for the connectivity graph layer.

A ``Patch`` is the interface between segmentation and graph analysis
(paper Eq. 2):  Patch_i = {A_i, (x_i, y_i), C_i, H_i}.

Coordinates are stored as WGS84 (lat, lon) so that inter-patch distance is
always a great-circle distance in kilometres, matching the offline experiment
that produced the paper's Tables VI-VIII.  A planar (x, y) mode is available
for unit tests and for rasters already in a projected CRS.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Optional


@dataclass
class Patch:
    id: str
    area_ha: float
    centroid: tuple[float, float]           # (lat, lon)  or (x_km, y_km) in planar mode
    quality: float = 1.0                     # q_i in [0, 1]  (Eq. 6)
    confidence: float = 1.0                  # C_i in [0, 1]  (Eq. 2) - mean class probability
    habitat_class: str = "mangrove"          # H_i
    name: Optional[str] = None
    protected: bool = False
    perimeter_km: Optional[float] = None
    bbox: Optional[tuple[float, float, float, float]] = None   # (min_lat, min_lon, max_lat, max_lon)
    geometry: Optional[dict[str, Any]] = None                 # GeoJSON geometry (optional, for export)
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["centroid"] = list(self.centroid)
        return d


@dataclass(frozen=True)
class Edge:
    source: str
    target: str
    distance_km: float
    weight: float                           # w_ij  (Eq. 6)

    @property
    def key(self) -> tuple[str, str]:
        return (self.source, self.target) if self.source < self.target else (self.target, self.source)

    def to_dict(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "target": self.target,
            "distance_km": self.distance_km,
            "weight": self.weight,
        }
