"""Normalization layer — RawEvent → NormalizedEvent."""
from veralith_pipeline.normalization.schemas import NormalizedEvent, EventType, EventLocation
from veralith_pipeline.normalization.transformers import normalize, normalize_batch
from veralith_pipeline.normalization.validator import SchemaValidator, ValidationError

__all__ = [
    "NormalizedEvent", "EventType", "EventLocation",
    "normalize", "normalize_batch",
    "SchemaValidator", "ValidationError",
]
