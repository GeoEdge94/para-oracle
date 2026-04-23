"""Ingestion layer — fetch raw events from official sources."""
from veralith_pipeline.ingestion.base import (
    BaseConnector,
    BoundingBox,
    TimeRange,
    RawEvent,
    FetchResult,
)
from veralith_pipeline.ingestion.nasa_firms import NasaFirmsConnector
from veralith_pipeline.ingestion.effis import EffisConnector
from veralith_pipeline.ingestion.noaa import NoaaConnector
from veralith_pipeline.ingestion.usgs import UsgsConnector
from veralith_pipeline.ingestion.vigicrues import VigicruesConnector

__all__ = [
    "BaseConnector",
    "BoundingBox",
    "TimeRange",
    "RawEvent",
    "FetchResult",
    "NasaFirmsConnector",
    "EffisConnector",
    "NoaaConnector",
    "UsgsConnector",
    "VigicruesConnector",
]
