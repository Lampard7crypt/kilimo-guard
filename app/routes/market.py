from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.market import evaluate_sale_price, get_all_prices

router = APIRouter(prefix="/api/market", tags=["Kenya Market Intelligence"])


class PriceCompareRequest(BaseModel):
    commodity: str
    unit_price: float
    unit: str = "90kg bag"
    county: Optional[str] = None


@router.get("/prices")
def fetch_market_prices(
    commodity: Optional[str] = Query(None, description="Filter by crop/commodity"),
    db: Session = Depends(get_db),
):
    """Retrieve indicative market prices across Wakulima, Kongowea, Nakuru, Eldoret, and Kisumu."""
    return get_all_prices(db, commodity_filter=commodity)


@router.post("/compare")
def compare_price(payload: PriceCompareRequest, db: Session = Depends(get_db)):
    """Evaluate whether an offer or asking price is fair compared to Kenyan wholesale benchmarks."""
    return evaluate_sale_price(
        commodity=payload.commodity,
        unit_price=payload.unit_price,
        unit=payload.unit,
        db=db,
        farmer_county=payload.county,
    )
