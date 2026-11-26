import os
from functools import lru_cache


class Settings:
    """Environment-backed settings without a framework dependency."""
    def __init__(self) -> None:
        self.database_url = os.getenv("DATABASE_URL", "sqlite:///./sentinel.db")
        self.allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
        self.require_auth = os.getenv("REQUIRE_AUTH", "false").lower() == "true"

    @property
    def cors_origins(self) -> list[str]:
        return [item.strip() for item in self.allowed_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
