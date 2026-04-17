"""
Tests de reproductibilite du SpectralPipeline.

Pour chaque indice spectral, 3 runs avec les memes entrees doivent
produire exactement les memes hashes SHA-256.
"""
import os
import pytest
from datetime import date

os.environ.setdefault("USE_MOCK_SENTINEL", "true")
os.environ.setdefault("DATA_DIR", "/tmp/para-test-runs")

from app.services.spectral_pipeline import SpectralPipeline, PipelineConfig, BANDS_NEEDED


REGION_WKT = "MULTIPOLYGON(((-59 -9.5, -46 -9.5, -46 2.5, -59 2.5, -59 -9.5)))"

TEST_CONFIGS = {
    "NDVI": {
        "bet_slug": "test-ndvi-repro",
        "change_direction": "decrease",
        "change_threshold": 0.3,
        "threshold_value": 4200.0,
    },
    "NBR": {
        "bet_slug": "test-nbr-repro",
        "change_direction": "increase",
        "change_threshold": 0.27,
        "threshold_value": 10000.0,
    },
    "NDWI": {
        "bet_slug": "test-ndwi-repro",
        "change_direction": "increase",
        "change_threshold": 0.3,
        "threshold_value": 500.0,
    },
    "BSI": {
        "bet_slug": "test-bsi-repro",
        "change_direction": "increase",
        "change_threshold": 0.1,
        "threshold_value": 15.0,
    },
    "NDSI": {
        "bet_slug": "test-ndsi-repro",
        "change_direction": "decrease",
        "change_threshold": 0.4,
        "threshold_value": 0.5,
    },
    "NDBI": {
        "bet_slug": "test-ndbi-repro",
        "change_direction": "increase",
        "change_threshold": 0.15,
        "threshold_value": 5.0,
    },
    "EVI": {
        "bet_slug": "test-evi-repro",
        "change_direction": "decrease",
        "change_threshold": 0.2,
        "threshold_value": 4000.0,
    },
    "MNDWI": {
        "bet_slug": "test-mndwi-repro",
        "change_direction": "increase",
        "change_threshold": 0.3,
        "threshold_value": 400.0,
    },
}


def _make_config(index_type: str) -> PipelineConfig:
    params = TEST_CONFIGS[index_type]
    return PipelineConfig(
        bet_slug=params["bet_slug"],
        period_start=date(2025, 1, 1),
        period_end=date(2025, 6, 30),
        region_geom_wkt=REGION_WKT,
        index_type=index_type,
        change_direction=params["change_direction"],
        change_threshold=params["change_threshold"],
        threshold_value=params["threshold_value"],
    )


def _extract_hashes(result) -> tuple:
    return (
        result.script_hash,
        result.index_t0_hash,
        result.index_t1_hash,
        result.delta_hash,
        result.mask_hash,
    )


@pytest.mark.parametrize("index_type", list(BANDS_NEEDED.keys()))
def test_reproducibility_3_runs(index_type: str):
    """3 runs with identical inputs must produce identical SHA-256 hashes."""
    config = _make_config(index_type)
    results = [SpectralPipeline(config).run() for _ in range(3)]

    for r in results:
        assert r.success, f"{index_type} failed: {r.error}"

    hashes = [_extract_hashes(r) for r in results]
    assert hashes[0] == hashes[1] == hashes[2], (
        f"{index_type} non-deterministic!\n"
        f"  run1: {hashes[0]}\n"
        f"  run2: {hashes[1]}\n"
        f"  run3: {hashes[2]}"
    )


@pytest.mark.parametrize("index_type", list(BANDS_NEEDED.keys()))
def test_different_indices_different_hashes(index_type: str):
    """Each index type must produce different hashes (different formulas)."""
    config = _make_config(index_type)
    r = SpectralPipeline(config).run()
    assert r.success

    # Compare with NDVI (unless we ARE NDVI)
    if index_type != "NDVI":
        ndvi_config = _make_config("NDVI")
        ndvi_r = SpectralPipeline(ndvi_config).run()
        assert ndvi_r.success
        assert _extract_hashes(r) != _extract_hashes(ndvi_r), (
            f"{index_type} produced same hashes as NDVI — formulas not differentiated"
        )


@pytest.mark.parametrize("index_type", list(BANDS_NEEDED.keys()))
def test_pipeline_returns_correct_bands(index_type: str):
    """Pipeline result must report the correct bands for its index type."""
    config = _make_config(index_type)
    r = SpectralPipeline(config).run()
    assert r.success
    assert r.params["bands"] == BANDS_NEEDED[index_type]
    assert r.params["index_type"] == index_type


def test_outcome_yes_when_above_threshold():
    config = _make_config("NDVI")
    config.threshold_value = 1.0  # very low → outcome should be YES
    r = SpectralPipeline(config).run()
    assert r.success
    assert r.outcome_yes is True


def test_outcome_no_when_below_threshold():
    config = _make_config("NDVI")
    config.threshold_value = 999999.0  # impossibly high → outcome should be NO
    r = SpectralPipeline(config).run()
    assert r.success
    assert r.outcome_yes is False


def test_ipfs_cid_format():
    config = _make_config("NDVI")
    r = SpectralPipeline(config).run()
    assert r.success
    assert r.ipfs_cid.startswith("bafybei")
    assert len(r.ipfs_cid) > 20


def test_script_hash_includes_index_type():
    """Different index types must produce different script hashes."""
    r_ndvi = SpectralPipeline(_make_config("NDVI")).run()
    r_nbr = SpectralPipeline(_make_config("NBR")).run()
    assert r_ndvi.script_hash != r_nbr.script_hash
