"""
CopernicusClient — wrapper pour Copernicus Data Space Ecosystem.

APIs cibles (documentees) :
- STAC API     : https://catalogue.dataspace.copernicus.eu/stac
- OData API    : https://catalogue.dataspace.copernicus.eu/odata/v1/Products
- OAuth token  : https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token

En mode USE_MOCK_SENTINEL=true : retourne des reponses factices pour la demo.
En mode reel : effectue les appels HTTP (OAuth client_credentials + STAC search).
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Optional
import httpx

from app.core.config import settings


@dataclass
class SentinelProduct:
    """Produit Sentinel-2 L2A retourne par STAC."""
    id: str                 # ex: "S2A_MSIL2A_20250105T134201_N0511_R124_T22LDH_20250105T154832"
    datetime: datetime
    cloud_cover: float
    tile: str               # ex: "22LDH"
    stac_uri: str
    asset_b04_url: Optional[str] = None   # RED
    asset_b08_url: Optional[str] = None   # NIR
    bbox: Optional[list[float]] = None    # [minx, miny, maxx, maxy]


class CopernicusClient:
    """
    Client STAC pour Copernicus Data Space Ecosystem.
    Utilise pystac-client en mode reel, mocks en mode demo.
    """
    STAC_URL = "https://catalogue.dataspace.copernicus.eu/stac"
    TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"

    def __init__(self, client_id: str = "", client_secret: str = "", use_mock: bool = True):
        self.client_id = client_id
        self.client_secret = client_secret
        # Auto-fallback to mock if credentials missing, regardless of use_mock flag
        self.use_mock = use_mock or not (client_id and client_secret)
        self._token: Optional[str] = None

    def is_authenticated(self) -> tuple[bool, str]:
        """
        Check whether real credentials are available AND a token can be obtained.
        Returns (ok, message).
        """
        if not self.client_id or not self.client_secret:
            return False, "missing COPERNICUS_CLIENT_ID / COPERNICUS_CLIENT_SECRET"
        try:
            resp = httpx.post(
                self.TOKEN_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                },
                timeout=10,
            )
            if resp.status_code == 200 and "access_token" in resp.json():
                return True, "token acquired"
            return False, f"token endpoint replied {resp.status_code}: {resp.text[:200]}"
        except httpx.HTTPError as e:
            return False, f"network error: {e}"

    def _get_token(self) -> str:
        """OAuth2 client_credentials flow pour obtenir un access token."""
        if self._token:
            return self._token
        if self.use_mock:
            self._token = "mock-token"
            return self._token

        resp = httpx.post(
            self.TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            },
            timeout=30,
        )
        resp.raise_for_status()
        self._token = resp.json()["access_token"]
        return self._token

    def search_s2_l2a(
        self,
        bbox: list[float],
        date_start: date,
        date_end: date,
        max_cloud_cover: float = 20.0,
        limit: int = 50,
    ) -> list[SentinelProduct]:
        """
        Recherche les produits Sentinel-2 L2A intersectant le bbox sur la periode.

        En reel, equivalent STAC API :
          POST /stac/search
          {
            "collections": ["SENTINEL-2"],
            "bbox": [...],
            "datetime": "2025-01-01T00:00:00Z/2025-01-15T23:59:59Z",
            "filter": {"op": "and", "args": [
              {"op": "=", "args": [{"property": "processingLevel"}, "S2MSI2A"]},
              {"op": "<=", "args": [{"property": "eo:cloud_cover"}, 20]}
            ]},
            "limit": 50
          }
        """
        if self.use_mock:
            return self._mock_products(bbox, date_start, date_end)

        token = self._get_token()
        headers = {"Authorization": f"Bearer {token}"}
        body = {
            "collections": ["SENTINEL-2"],
            "bbox": bbox,
            "datetime": f"{date_start.isoformat()}T00:00:00Z/{date_end.isoformat()}T23:59:59Z",
            "filter": {
                "op": "and",
                "args": [
                    {"op": "=", "args": [{"property": "processingLevel"}, "S2MSI2A"]},
                    {"op": "<=", "args": [{"property": "eo:cloud_cover"}, max_cloud_cover]},
                ],
            },
            "limit": limit,
        }
        resp = httpx.post(f"{self.STAC_URL}/search", json=body, headers=headers, timeout=60)
        resp.raise_for_status()
        features = resp.json().get("features", [])
        return [self._parse_stac_feature(f) for f in features]

    @staticmethod
    def _parse_stac_feature(feature: dict) -> SentinelProduct:
        props = feature.get("properties", {})
        assets = feature.get("assets", {})
        return SentinelProduct(
            id=feature.get("id", ""),
            datetime=datetime.fromisoformat(props.get("datetime", "").replace("Z", "+00:00")),
            cloud_cover=float(props.get("eo:cloud_cover", 0)),
            tile=props.get("grid:code", ""),
            stac_uri=feature.get("links", [{}])[0].get("href", ""),
            asset_b04_url=assets.get("B04", {}).get("href"),
            asset_b08_url=assets.get("B08", {}).get("href"),
            bbox=feature.get("bbox"),
        )

    @staticmethod
    def _mock_products(bbox: list[float], date_start: date, date_end: date) -> list[SentinelProduct]:
        """Reponse factice pour la demo — 2 tuiles Para representatives."""
        dt = datetime(date_start.year, date_start.month, date_start.day, 13, 42, tzinfo=timezone.utc)
        return [
            SentinelProduct(
                id=f"S2A_MSIL2A_{dt.strftime('%Y%m%dT%H%M%S')}_N0511_R124_T22LDH_{dt.strftime('%Y%m%dT%H%M%S')}",
                datetime=dt,
                cloud_cover=8.5,
                tile="22LDH",
                stac_uri="https://catalogue.dataspace.copernicus.eu/stac/collections/SENTINEL-2/items/mock-22LDH",
                bbox=bbox,
            ),
            SentinelProduct(
                id=f"S2B_MSIL2A_{dt.strftime('%Y%m%dT%H%M%S')}_N0511_R124_T22MDT_{dt.strftime('%Y%m%dT%H%M%S')}",
                datetime=dt,
                cloud_cover=12.1,
                tile="22MDT",
                stac_uri="https://catalogue.dataspace.copernicus.eu/stac/collections/SENTINEL-2/items/mock-22MDT",
                bbox=bbox,
            ),
        ]
