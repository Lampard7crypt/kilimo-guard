import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.gemma import GemmaUnavailable, ask_gemma_json
from app.services.market import evaluate_sale_price, get_all_prices

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/market", tags=["Kenya Market Intelligence"])


class PriceCompareRequest(BaseModel):
    commodity: str
    unit_price: float
    unit: str = "90kg bag"
    county: Optional[str] = None


class MarketAIAdvisoryRequest(BaseModel):
    commodity: str
    county: str = "Nakuru"
    question: Optional[str] = None


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


@router.post("/ai-advisory")
def get_market_ai_advisory(payload: MarketAIAdvisoryRequest, db: Session = Depends(get_db)):
    """Use Google Gemma to analyze real Kenyan market price trends, regional arbitrage, and negotiation strategy."""
    all_prices = get_all_prices(db, commodity_filter=payload.commodity)
    price_context = "\n".join(
        [
            f"- {p['commodity']} at {p['market_name']} ({p['county']}): KES {p['price_low']:,.0f} - {p['price_high']:,.0f} (Avg: KES {p['price_avg']:,.0f} per {p['unit']})"
            for p in all_prices
        ]
    )

    system_prompt = """
You are KilimoGuard's Senior Agricultural Commodity Analyst and Trading Strategist for Kenya.
You advise Kenyan farmers on wholesale commodity prices across major markets (Nairobi Wakulima, Mombasa Kongowea, Nakuru, Eldoret, Kisumu).
Your goal is to maximize farmer income, identify inter-county transport arbitrage opportunities, and advise on optimal selling timing vs storage.

Respond ONLY with valid JSON in this exact structure:
{
  "recommendation": "<Direct 1-sentence verdict: e.g. 'Sell in Nairobi Wakulima', 'Hold/Store for 3 weeks', 'Accept current local offer'>",
  "arbitrage_analysis": "<Analysis of price spread between local market and major transit hubs like Wakulima or Kongowea>",
  "seasonal_outlook": "<Expected price direction over the next 30-60 days based on harvest cycles in Kenya>",
  "negotiation_tip": "<Practical, street-smart advice for dealing with brokers / middlemen to avoid being shortchanged>",
  "fair_farmgate_range": "<Realistic farmgate price in KES that the farmer should demand at the farm gate>"
}
"""

    user_query = f"""
Farmer location: {payload.county}
Target commodity: {payload.commodity}
Farmer's specific question: {payload.question or f"What is the best market strategy for my {payload.commodity} right now?"}

Current verified Kenyan wholesale price benchmarks:
{price_context if price_context else "Standard Kenyan wholesale price benchmarks apply."}
"""

    try:
        data, answer = ask_gemma_json(prompt=user_query, system_prompt=system_prompt)
    except GemmaUnavailable:
        raise HTTPException(status_code=503, detail="Gemma market analyst is currently busy. Please retry.")
    except Exception as exc:
        log.exception("Market AI advisory failed: %s", exc)
        raise HTTPException(status_code=502, detail="Unable to generate market advisory at this time.")

    return {
        "commodity": payload.commodity,
        "county": payload.county,
        "recommendation": data.get("recommendation", "Sell at prevailing wholesale market rates."),
        "arbitrage_analysis": data.get("arbitrage_analysis", "Review transport costs before shipping to regional hubs."),
        "seasonal_outlook": data.get("seasonal_outlook", "Stable pricing expected across the next 30 days."),
        "negotiation_tip": data.get("negotiation_tip", "Weigh produce with certified digital scales rather than visual bagging."),
        "fair_farmgate_range": data.get("fair_farmgate_range", "Align with local wholesale average minus transport."),
        "model_used": answer.model,
    }
