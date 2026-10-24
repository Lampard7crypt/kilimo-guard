from fastapi import APIRouter, Query
from app.services.weather import get_county_weather

router = APIRouter(prefix="/api/weather", tags=["Weather & Agronomy"])


@router.get("")
def get_weather(county: str = Query("Nakuru", description="Kenyan county name")):
    """Get live weather metrics and localized agricultural advisory for a Kenyan county."""
    return get_county_weather(county)
