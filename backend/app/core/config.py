"""
Application settings from environment variables.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    DATABASE_URL: str = "postgresql+psycopg2://paraoracle:paraoracle_dev@db:5432/paraoracle"

    # Copernicus
    COPERNICUS_BASE_URL: str = "https://catalogue.dataspace.copernicus.eu"
    COPERNICUS_CLIENT_ID: str = ""
    COPERNICUS_CLIENT_SECRET: str = ""
    USE_MOCK_SENTINEL: bool = True

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
