import os
from dataclasses import dataclass
from pathlib import Path
from typing import Tuple
from dotenv import load_dotenv

# Load environment variables from .env file
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


@dataclass(frozen=True)
class Settings:
    # Gemini / Gemma AI Settings
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemma_models: Tuple[str, ...] = tuple(
        m.strip()
        for m in os.getenv("GEMMA_MODELS", "gemma-4-26b-a4b-it,gemma-4-31b-it").split(",")
        if m.strip()
    )
    gemma_retries: int = int(os.getenv("GEMMA_RETRIES_PER_MODEL", "2"))
    gemma_base_delay: float = float(os.getenv("GEMMA_BASE_DELAY_S", "1.0"))
    gemma_timeout: float = float(os.getenv("GEMMA_TIMEOUT_S", "35.0"))

    # Database Settings (DigitalOcean Managed PostgreSQL or local SQLite fallback)
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./kilimoguard.db")

    # DigitalOcean Spaces (S3-Compatible Object Storage)
    do_spaces_key: str = os.getenv("DO_SPACES_KEY", "")
    do_spaces_secret: str = os.getenv("DO_SPACES_SECRET", "")
    do_spaces_region: str = os.getenv("DO_SPACES_REGION", "nyc3")
    do_spaces_bucket: str = os.getenv("DO_SPACES_BUCKET", "kilimo-guard-storage")
    do_spaces_endpoint: str = os.getenv("DO_SPACES_ENDPOINT", "https://nyc3.digitaloceanspaces.com")

    # Storage & directories
    uploads_dir: Path = (
        Path("/tmp/uploads") if os.getenv("VERCEL") else BASE_DIR / "uploads"
    )
    port: int = int(os.getenv("PORT", "8000"))
    host: str = os.getenv("HOST", "0.0.0.0")

    @property
    def has_do_spaces(self) -> bool:
        """Check if DigitalOcean Spaces credentials are configured."""
        return bool(self.do_spaces_key and self.do_spaces_secret and self.do_spaces_bucket)

    @property
    def normalized_database_url(self) -> str:
        """Normalize database URL for SQLAlchemy compatibility with Vercel serverless fallback."""
        url = self.database_url
        if not url:
            if os.getenv("VERCEL"):
                return "sqlite:////tmp/kilimoguard.db"
            return "sqlite:///./kilimoguard.db"
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url


settings = Settings()
