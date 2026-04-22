"""
CDSClient — wrapper Copernicus Climate Data Store (distinct de CDSE/STAC).

APIs cibles :
  - Reanalysis ERA5-Land : https://cds.climate.copernicus.eu/api (cdsapi)
    Variables supportees MVP : total_precipitation (m, cumul horaire)
  - Extension v2 : EFAS/GloFAS (river_discharge), 2m_temperature, volumetric_soil_water

En mode USE_MOCK_CDS=true : reponses factices deterministes seed sur bet_slug.
En mode reel : appel cdsapi.Client().retrieve(...) qui telecharge un NetCDF
puis on extrait les valeurs sur la bbox via rioxarray.

Note: le service CDS utilise une queue asynchrone cote serveur — les requetes
peuvent prendre plusieurs minutes. Pour le MVP on accepte la latence synchrone
(timeout ~5min). Pattern async en v2.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
import hashlib
import random


@dataclass
class CDSRequest:
    """Requete CDS serialisable — inclue dans le fingerprint si USE_MOCK_CDS=false."""
    dataset: str                        # ex: "reanalysis-era5-land"
    variable: str                       # ex: "total_precipitation"
    product_type: str = "reanalysis"
    year: list[str] = field(default_factory=list)
    month: list[str] = field(default_factory=list)
    day: list[str] = field(default_factory=list)
    time: list[str] = field(default_factory=list)
    area: list[float] = field(default_factory=list)  # [N, W, S, E] format CDS
    format: str = "netcdf"

    def to_dict(self) -> dict:
        return {
            "product_type": self.product_type,
            "variable": self.variable,
            "year": self.year,
            "month": self.month,
            "day": self.day,
            "time": self.time,
            "area": self.area,
            "format": self.format,
        }


@dataclass
class CDSResponse:
    """Reponse CDS : valeurs extraites + metadonnees utiles au fingerprint."""
    values: list[float]                 # valeurs numeriques sur la bbox/periode
    variable: str
    grid_resolution_deg: float = 0.1    # ERA5-Land = 0.1deg
    source: str = "ERA5-Land"
    request: dict = field(default_factory=dict)
    netcdf_path: Path | None = None     # None en mode mock


class CDSClient:
    """Client CDS — mock-first, API reelle en M1bis."""

    API_URL = "https://cds.climate.copernicus.eu/api"

    def __init__(self, api_url: str = "", api_key: str = "", use_mock: bool = True):
        self.api_url = api_url or self.API_URL
        self.api_key = api_key
        self.use_mock = use_mock or not api_key

    def is_authenticated(self) -> tuple[bool, str]:
        if not self.api_key:
            return False, "missing CDS_API_KEY"
        if self.use_mock:
            return False, "mock mode — credentials not tested"
        return True, "credentials present (not verified until first retrieve)"

    def retrieve_precipitation(
        self,
        *,
        bet_slug: str,
        bbox: list[float],          # [minx, miny, maxx, maxy] EPSG:4326
        date_start: date,
        date_end: date,
    ) -> CDSResponse:
        """
        Telecharge la variable total_precipitation sur la zone et periode.
        Valeurs cumulees quotidiennes en millimetres.
        """
        request = self._build_request(
            variable="total_precipitation",
            bbox=bbox,
            date_start=date_start,
            date_end=date_end,
        )

        if self.use_mock:
            return self._mock_response(bet_slug, request, date_start, date_end)

        return self._real_retrieve(request)

    def _build_request(
        self,
        *,
        variable: str,
        bbox: list[float],
        date_start: date,
        date_end: date,
    ) -> CDSRequest:
        years = sorted({str(y) for y in range(date_start.year, date_end.year + 1)})
        months = sorted({f"{m:02d}" for m in range(date_start.month, date_end.month + 1)})
        days = [f"{d:02d}" for d in range(1, 32)]
        times = [f"{h:02d}:00" for h in range(0, 24)]
        # CDS utilise [North, West, South, East] au lieu de [minx, miny, maxx, maxy]
        area = [bbox[3], bbox[0], bbox[1], bbox[2]]
        return CDSRequest(
            dataset="reanalysis-era5-land",
            variable=variable,
            year=years,
            month=months,
            day=days,
            time=times,
            area=area,
        )

    @staticmethod
    def _mock_response(
        bet_slug: str,
        request: CDSRequest,
        date_start: date,
        date_end: date,
    ) -> CDSResponse:
        """
        Genere une serie de valeurs deterministe sur bet_slug + variable.
        Une valeur par jour sur la periode, en mm (total_precipitation cumul quotidien).
        """
        rng = random.Random(f"{bet_slug}:{request.variable}")
        n_days = max((date_end - date_start).days + 1, 1)
        # Precipitations realistes : 0-15 mm/jour en base + pics rares 50-120 mm
        values = []
        for _ in range(n_days):
            if rng.random() < 0.05:  # 5% chance de pic
                values.append(round(50.0 + rng.uniform(0, 70), 3))
            else:
                values.append(round(rng.uniform(0, 15), 3))
        return CDSResponse(
            values=values,
            variable=request.variable,
            grid_resolution_deg=0.1,
            source="ERA5-Land (mock)",
            request=request.to_dict(),
        )

    @staticmethod
    def _real_retrieve(request: CDSRequest) -> CDSResponse:
        """Stub pour l'integration cdsapi reelle. A implementer en M1bis."""
        raise NotImplementedError(
            "CDS real retrieve not yet implemented. "
            "Requires: cdsapi.Client().retrieve(dataset, params, target.nc) + "
            "rioxarray extraction on bbox."
        )
