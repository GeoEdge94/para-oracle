"""
Firestore client — persistance des EvidenceBundle pour audit history.

Mock mode: stockage in-memory. Real mode: google.cloud.firestore (lazy import).
"""
from __future__ import annotations
from typing import Any


class FirestoreClient:
    def __init__(self, *, mock: bool = False, project_id: str | None = None,
                 collection: str = "veralith_evidence") -> None:
        self.mock = mock
        self.project_id = project_id
        self.collection = collection
        self._memory: dict[str, dict[str, Any]] = {}
        self._client = None

    def _ensure_client(self):
        if self._client is None and not self.mock:
            from google.cloud import firestore  # lazy import (optional dep)
            self._client = firestore.Client(project=self.project_id)
        return self._client

    def store(self, doc_id: str, payload: dict[str, Any]) -> str:
        if self.mock:
            self._memory[doc_id] = payload
            return doc_id
        client = self._ensure_client()
        client.collection(self.collection).document(doc_id).set(payload)
        return doc_id

    def get(self, doc_id: str) -> dict[str, Any] | None:
        if self.mock:
            return self._memory.get(doc_id)
        client = self._ensure_client()
        snap = client.collection(self.collection).document(doc_id).get()
        return snap.to_dict() if snap.exists else None

    def list_ids(self) -> list[str]:
        if self.mock:
            return sorted(self._memory.keys())
        client = self._ensure_client()
        return sorted([d.id for d in client.collection(self.collection).list_documents()])
