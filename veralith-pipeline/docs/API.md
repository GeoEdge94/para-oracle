# Veralith Pipeline — API Reference

## Public surface

```python
# Ingestion
from veralith_pipeline.ingestion import (
    BaseConnector, BoundingBox, TimeRange, RawEvent, FetchResult,
    NasaFirmsConnector, EffisConnector, NoaaConnector, UsgsConnector, VigicruesConnector,
)

# Normalization
from veralith_pipeline.normalization import (
    NormalizedEvent, EventType, EventLocation,
    normalize, normalize_batch,
    SchemaValidator, ValidationError,
)

# Resolution
from veralith_pipeline.resolution import (
    Policy, PolicyEngine, PolicyResult, Outcome,
    EvidenceBuilder, EvidenceBundle,
    ConflictResolver, ConflictReport,
)

# Spatial
from veralith_pipeline.spatial import (
    filter_within_region, events_in_polygon,
    buffer_around_point, buffer_around_event,
    polygon_intersection, geom_area_km2,
)

# Storage
from veralith_pipeline.storage import IpfsClient, FirestoreClient, MemoryCache
```

## End-to-end example

```python
from datetime import datetime, timezone, timedelta
from pathlib import Path

from veralith_pipeline.ingestion import BoundingBox, TimeRange, NasaFirmsConnector, EffisConnector
from veralith_pipeline.normalization import normalize_batch, SchemaValidator
from veralith_pipeline.resolution import (
    Policy, PolicyEngine, ConflictResolver, EvidenceBuilder,
)
from veralith_pipeline.storage import IpfsClient, FirestoreClient

# 1. Define region + period
bbox = BoundingBox(west=-125, south=32, east=-114, north=42)
tr = TimeRange(
    start=datetime.now(timezone.utc) - timedelta(days=30),
    end=datetime.now(timezone.utc),
)

# 2. Ingest from multiple sources
raw = []
raw.extend(NasaFirmsConnector(api_key="...").fetch(bbox, tr).events)
raw.extend(EffisConnector().fetch(bbox, tr).events)

# 3. Normalize
normalized = normalize_batch(raw)
valid, _rejected = SchemaValidator().validate_batch(normalized)

# 4. Resolve conflicts
winners, _conflicts = ConflictResolver().resolve(valid)

# 5. Apply policy
policy = Policy.from_yaml("src/veralith_pipeline/resolution/policies/wildfire.yaml")
result = PolicyEngine().evaluate(policy, winners)

# 6. Build evidence bundle
bundle = EvidenceBuilder().build(bet_id="california-wildfire-2026", policy_result=result)

# 7. Persist
cid = IpfsClient(api_token="...").pin_json(bundle.canonical_dict())
FirestoreClient(project_id="veralith-prod").store(bundle.bet_id, {
    "bundle": bundle.canonical_dict(),
    "ipfs_cid": cid,
})
```

## Connector interface (BaseConnector)

```python
class BaseConnector(ABC):
    SOURCE_NAME: str            # "NASA_FIRMS" | "EFFIS" | ...
    SUPPORTED_TYPES: tuple[str, ...]

    def __init__(self, *, mock: bool = False, api_key: str | None = None): ...

    @abstractmethod
    def fetch(self, bbox: BoundingBox, time_range: TimeRange) -> FetchResult: ...

    def validate(self, events: Iterable[RawEvent]) -> ValidationResult: ...
```

Add a new source: subclass `BaseConnector`, set `SOURCE_NAME` + `SUPPORTED_TYPES`, implement `fetch()`. Add a transformer in `normalization/transformers.py` and register it in `_SOURCE_MAP`.

## Schema versioning

`NormalizedEvent.schema_version` is frozen at **1.0.0**. Breaking changes bump major.

`Policy.version` is per-policy YAML. Bump on threshold/rule changes.

Both versions are recorded in `EvidenceBundle.canonical_dict()` so downstream consumers can reject stale bundles.
