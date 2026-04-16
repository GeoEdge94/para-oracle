"""
ParaOracle — FastAPI entrypoint
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import auth, bets, layers, oracle, analyses, tiles

app = FastAPI(
    title="ParaOracle API",
    description="Oracle determinist pour le marche de prediction Para deforestation",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
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


@app.get("/health")
def health():
    return {"status": "ok", "service": "para-oracle-api"}


@app.get("/")
def root():
    return {
        "service": "ParaOracle API",
        "version": "0.1.0",
        "docs": "/docs",
        "bet_demo": "para-deforestation-2025-s1",
    }
