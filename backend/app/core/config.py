"""
Application settings from environment variables.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    DATABASE_URL: str = "postgresql+psycopg2://paraoracle:paraoracle_dev@db:5432/paraoracle"

    # Copernicus Data Space Ecosystem (Sentinel-2 STAC)
    COPERNICUS_BASE_URL: str = "https://catalogue.dataspace.copernicus.eu"
    COPERNICUS_CLIENT_ID: str = ""
    COPERNICUS_CLIENT_SECRET: str = ""
    USE_MOCK_SENTINEL: bool = True

    # Copernicus Climate Data Store (ERA5-Land meteo)
    CDS_API_URL: str = "https://cds.climate.copernicus.eu/api"
    CDS_API_KEY: str = ""
    USE_MOCK_CDS: bool = True

    # Web3 publishing (M2+)
    USE_WEB3_PUBLISHING: bool = True
    USE_MOCK_IPFS: bool = True
    USE_MOCK_TLSNOTARY: bool = True
    USE_MOCK_CHAIN: bool = True
    PINATA_JWT: str = ""
    IPFS_GATEWAY_URL: str = "https://gateway.pinata.cloud/ipfs/"
    SCHEMA_V1_CID: str = ""
    TLSNOTARY_NOTARY_URL: str = ""
    CHAIN_RPC_URL: str = "https://rpc-amoy.polygon.technology"
    CHAIN_ID: int = 80002
    ORACLE_PRIVATE_KEY: str = ""
    PARA_ORACLE_ADDRESS: str = ""
    USDC_ADDRESS: str = ""
    BOND_AMOUNT_USDC: float = 500.0
    DISPUTE_WINDOW_SECONDS: int = 172800  # 48h

    # Auth
    JWT_SECRET: str = "change_me_in_prod"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # CORS — comma-separated string, split at runtime
    CORS_ORIGINS: str = "http://localhost:3000"

    # Data
    DATA_DIR: str = "/data"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
