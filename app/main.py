import logging
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.routes import auth, chat, growth, ledger, market, scan, weather
from app.services.market import seed_market_prices

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("kilimoguard")

# Initialize database schema
Base.metadata.create_all(bind=engine)

# Seed initial Kenyan market prices
try:
    with SessionLocal() as db_session:
        seed_market_prices(db_session)
except Exception as e:
    log.warning("Could not pre-seed market prices on startup: %s", e)

app = FastAPI(
    title="KilimoGuard API",
    description="AI Agricultural Copilot & Digital Ledger for Kenyan Farmers powered by Google Gemma and DigitalOcean",
    version="1.0.0",
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static and uploads directory setup
STATIC_DIR = Path(__file__).resolve().parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
settings.uploads_dir.mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/uploads", StaticFiles(directory=settings.uploads_dir), name="uploads")

# Include API Routers
app.include_router(auth.router)
app.include_router(growth.router)
app.include_router(scan.router)
app.include_router(ledger.router)
app.include_router(chat.router)
app.include_router(weather.router)
app.include_router(market.router)



@app.get("/health")
@app.get("/api/health")
def health():
    """Health check endpoint for DigitalOcean App Platform, Vercel, and monitoring."""
    db_type = "postgresql" if "postgresql" in settings.database_url else "sqlite"
    return {
        "status": "healthy",
        "service": "KilimoGuard",
        "version": "1.0.0",
        "cloud_storage": "digitalocean_spaces" if settings.has_do_spaces else "local_fallback",
        "database": db_type,
        "gemma_configured": bool(settings.gemini_api_key),
        "models": list(settings.gemma_models),
    }


@app.get("/")
@app.get("/api")
@app.get("/api/index.py")
def index():
    """Serve KilimoGuard farmer dashboard."""
    for path in [
        STATIC_DIR / "index.html",
        STATIC_DIR.parent.parent / "public" / "index.html",
    ]:
        if path.exists():
            return FileResponse(path)
    return {"message": "KilimoGuard API is running. Web frontend loading..."}

