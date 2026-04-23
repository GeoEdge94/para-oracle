"""Tests storage : IPFS mock + Firestore mock + MemoryCache."""
import time
import pytest

from veralith_pipeline.storage import IpfsClient, FirestoreClient, MemoryCache


class TestIpfsMock:
    def test_pin_json_returns_cid(self):
        client = IpfsClient(mock=True)
        cid = client.pin_json({"foo": "bar"})
        assert cid.startswith("bafybei")
        assert len(cid) > 10

    def test_pin_json_deterministic(self):
        c = IpfsClient(mock=True)
        cid1 = c.pin_json({"a": 1, "b": 2})
        cid2 = c.pin_json({"b": 2, "a": 1})  # different order
        assert cid1 == cid2  # canonical sort_keys

    def test_pin_bytes(self):
        c = IpfsClient(mock=True)
        cid = c.pin_bytes(b"hello world")
        assert cid.startswith("bafybei")

    def test_no_token_raises_in_real_mode(self):
        c = IpfsClient(mock=False)
        with pytest.raises(ValueError, match="api_token"):
            c.pin_json({"x": 1})


class TestFirestoreMock:
    def test_store_and_get(self):
        c = FirestoreClient(mock=True)
        doc_id = c.store("doc-1", {"outcome": "YES"})
        assert doc_id == "doc-1"
        retrieved = c.get("doc-1")
        assert retrieved == {"outcome": "YES"}

    def test_get_missing_returns_none(self):
        assert FirestoreClient(mock=True).get("nope") is None

    def test_list_ids(self):
        c = FirestoreClient(mock=True)
        c.store("a", {})
        c.store("b", {})
        c.store("c", {})
        assert c.list_ids() == ["a", "b", "c"]


class TestMemoryCache:
    def test_set_get(self):
        c = MemoryCache()
        c.set("k", "v")
        assert c.get("k") == "v"

    def test_ttl_expiry(self):
        c = MemoryCache()
        c.set("k", "v", ttl_seconds=1)
        assert c.get("k") == "v"
        time.sleep(1.1)
        assert c.get("k") is None

    def test_delete(self):
        c = MemoryCache()
        c.set("k", "v")
        c.delete("k")
        assert c.get("k") is None

    def test_clear(self):
        c = MemoryCache()
        c.set("a", 1)
        c.set("b", 2)
        c.clear()
        assert c.get("a") is None
        assert c.get("b") is None
