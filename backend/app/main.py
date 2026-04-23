"""
ParaOracle — FastAPI entrypoint
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import auth, bets, layers, oracle, analyses, tiles, user_bets, zones, wallet

TAGS_METADATA = [
    {"name": "auth", "description": "Authentification mock (MVP). Accepte tout email/password, retourne un token."},
    {"name": "bets", "description": "Paris de prediction. Un bet = une question YES/NO resolue par le pipeline NDVI."},
    {"name": "layers", "description": "Configuration des 16 couches cartographiques (basemaps, satellite, cadastres, NDVI)."},
    {"name": "oracle", "description": "Resolution deterministe des paris via pipeline Sentinel-2 NDVI. POST resolve + GET status."},
    {"name": "analyses", "description": "Historique des resolutions avec preuves SHA-256, surfaces et CID IPFS."},
    {"name": "tiles", "description": "Proxy de tuiles avec cache disque. Pre-warm PRODES/DETER sur Para z4-8."},
    {"name": "user_bets", "description": "Placements utilisateurs sur les paris (mock data)."},
    {"name": "zones", "description": "Zones de deforestation detectees (preuves spatialisees)."},
    {"name": "wallet", "description": "Simulateur 10k EUR. Balance, placement, reset, settlement auto."},
]

app = FastAPI(
    title="ParaOracle API",
    description=(
        "**Oracle deterministe pour le marche de prediction sur la deforestation au Para (Amazonie)**\n\n"
        "Pipeline: Sentinel-2 L2A → NDVI composites → delta → masque binaire → surface km² → YES/NO.\n\n"
        "Toute resolution est reproductible (memes entrees → memes sorties) et auditable "
        "(5 hashes SHA-256 + CID IPFS).\n\n"
        "---\n\n"
        "**Sources de verite integrees**: PRODES/DETER (INPE), Hansen (GFW), NASA GIBS.\n\n"
        "**Tile cache**: les couches sont servies depuis le disque local apres premier fetch upstream."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=TAGS_METADATA,
    contact={"name": "GeoEdge", "url": "https://github.com/GeoEdge94/para-oracle"},
    license_info={"name": "MIT"},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(bets.router, prefix="/bets", tags=["bets"])
app.include_router(layers.router, prefix="/layers", tags=["layers"])
app.include_router(oracle.router, prefix="/oracle", tags=["oracle"])
app.include_router(analyses.router, prefix="/analyses", tags=["analyses"])
app.include_router(tiles.router, prefix="/tiles", tags=["tiles"])
app.include_router(user_bets.router, prefix="/user-bets", tags=["user_bets"])
app.include_router(zones.router, prefix="/zones", tags=["zones"])
app.include_router(wallet.router, prefix="/wallet", tags=["wallet"])


@app.get("/health")
def health(deep: bool = False):
    """
    Fast liveness check by default (just returns ok).
    Pass ?deep=1 for dependency status: DB reachability, chain RPC, IPFS gateway.
    Used by `docker healthcheck`, Fly.io, and the onboarding smoke test.
    """
    if not deep:
        return {"status": "ok", "service": "para-oracle-api"}

    from app.core.config import settings
    from app.core.database import SessionLocal
    from sqlalchemy import text
    import httpx

    checks = {}

    try:
        with SessionLocal() as s:
            s.execute(text("SELECT 1"))
        checks["db"] = "ok"
    except Exception as e:
        checks["db"] = f"fail: {e.__class__.__name__}"

    if not settings.USE_MOCK_CHAIN and settings.CHAIN_RPC_URL:
        try:
            r = httpx.post(
                settings.CHAIN_RPC_URL,
                json={"jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1},
                timeout=5,
            )
            r.raise_for_status()
            checks["chain_rpc"] = "ok"
        except Exception as e:
            checks["chain_rpc"] = f"fail: {e.__class__.__name__}"
    else:
        checks["chain_rpc"] = "skipped (mock)"

    if not settings.USE_MOCK_IPFS and settings.PINATA_JWT:
        try:
            r = httpx.get(
                "https://api.pinata.cloud/data/testAuthentication",
                headers={"Authorization": f"Bearer {settings.PINATA_JWT}"},
                timeout=5,
            )
            checks["pinata"] = "ok" if r.status_code == 200 else f"http_{r.status_code}"
        except Exception as e:
            checks["pinata"] = f"fail: {e.__class__.__name__}"
    else:
        checks["pinata"] = "skipped (mock)"

    overall = "ok" if all(v == "ok" or v.startswith("skipped") for v in checks.values()) else "degraded"
    return {"status": overall, "service": "para-oracle-api", "checks": checks}


@app.get("/")
def root():
    return {
        "service": "ParaOracle API",
        "version": "0.1.0",
        "docs": "/docs",
        "bet_demo": "para-deforestation-2025-s1",
    }
