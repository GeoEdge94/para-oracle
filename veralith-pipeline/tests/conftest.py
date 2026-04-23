"""Shared pytest fixtures."""
import pytest
from datetime import datetime, timezone, timedelta

from veralith_pipeline.ingestion.base import BoundingBox, TimeRange


@pytest.fixture
def bbox_california():
    return BoundingBox(west=-125.0, south=32.0, east=-114.0, north=42.0)


@pytest.fixture
def bbox_france():
    return BoundingBox(west=-5.0, south=41.0, east=10.0, north=51.0)


@pytest.fixture
def bbox_para():
    return BoundingBox(west=-59.0, south=-9.5, east=-46.0, north=2.5)


@pytest.fixture
def time_range_30d():
    end = datetime.now(tz=timezone.utc)
    return TimeRange(start=end - timedelta(days=30), end=end)


@pytest.fixture
def time_range_2025_h1():
    return TimeRange(
        start=datetime(2025, 1, 1, tzinfo=timezone.utc),
        end=datetime(2025, 6, 30, 23, 59, 59, tzinfo=timezone.utc),
    )
