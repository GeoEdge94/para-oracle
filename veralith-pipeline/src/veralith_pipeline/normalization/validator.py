"""
Validator — verifie qu'un NormalizedEvent ou un batch respecte les invariants.
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Iterable

from veralith_pipeline.normalization.schemas import NormalizedEvent


class ValidationError(Exception):
    pass


class SchemaValidator:
    """
    Stateless validator: applique les regles d'integrite metier.
    Les checks de format type/range sont deja faits par Pydantic au moment de la construction.
    """
    SUPPORTED_VERSIONS = ("1.0.0",)

    def validate_one(self, event: NormalizedEvent) -> None:
        if event.schema_version not in self.SUPPORTED_VERSIONS:
            raise ValidationError(f"Unsupported schema_version: {event.schema_version}")
        if event.timestamp > datetime.now(tz=timezone.utc):
            raise ValidationError(f"Future timestamp: {event.timestamp}")
        if not event.source_event_id:
            raise ValidationError("source_event_id missing")

    def validate_batch(self, events: Iterable[NormalizedEvent]) -> tuple[list[NormalizedEvent], list[tuple[NormalizedEvent, str]]]:
        valid: list[NormalizedEvent] = []
        rejected: list[tuple[NormalizedEvent, str]] = []
        for e in events:
            try:
                self.validate_one(e)
                valid.append(e)
            except ValidationError as exc:
                rejected.append((e, str(exc)))
        return valid, rejected
