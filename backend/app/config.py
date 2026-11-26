import os
from functools import lru_cache


class Settings:
    """Environment-backed settings without a framework dependency."""
    def __init__(self) -> None:
        self.database_url = os.getenv("DATABASE_URL", "sqlite:///./sentinel.db")
        self.allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
        self.require_auth = os.getenv("REQUIRE_AUTH", "false").lower() == "true"
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
        self.otel_exporter_otlp_endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")

    @property
    def cors_origins(self) -> list[str]:
        return [item.strip() for item in self.allowed_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
