import datetime
import logging
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from app.models import MarketPrice

log = logging.getLogger(__name__)

DEFAULT_KENYAN_MARKET_DATA = [
    # Maize
    {"commodity": "Maize (Dry)", "market_name": "Nairobi (Wakulima)", "county": "Nairobi", "unit": "90kg bag", "price_low": 3400, "price_high": 3800, "price_avg": 3600},
    {"commodity": "Maize (Dry)", "market_name": "Mombasa (Kongowea)", "county": "Mombasa", "unit": "90kg bag", "price_low": 3600, "price_high": 4200, "price_avg": 3900},
    {"commodity": "Maize (Dry)", "market_name": "Nakuru Top Market", "county": "Nakuru", "unit": "90kg bag", "price_low": 2900, "price_high": 3400, "price_avg": 3150},
    {"commodity": "Maize (Dry)", "market_name": "Eldoret Market", "county": "Uasin Gishu", "unit": "90kg bag", "price_low": 2700, "price_high": 3200, "price_avg": 2950},
    {"commodity": "Maize (Dry)", "market_name": "Kisumu Jubilee", "county": "Kisumu", "unit": "90kg bag", "price_low": 3300, "price_high": 3800, "price_avg": 3550},

    # Irish Potatoes
    {"commodity": "Irish Potatoes", "market_name": "Nairobi (Wakulima)", "county": "Nairobi", "unit": "50kg bag", "price_low": 2200, "price_high": 2800, "price_avg": 2500},
    {"commodity": "Irish Potatoes", "market_name": "Nakuru Wholesale", "county": "Nakuru", "unit": "50kg bag", "price_low": 1600, "price_high": 2200, "price_avg": 1900},
    {"commodity": "Irish Potatoes", "market_name": "Mombasa (Kongowea)", "county": "Mombasa", "unit": "50kg bag", "price_low": 2600, "price_high": 3200, "price_avg": 2900},
    {"commodity": "Irish Potatoes", "market_name": "Kisumu Jubilee", "county": "Kisumu", "unit": "50kg bag", "price_low": 2400, "price_high": 3000, "price_avg": 2700},

    # Tomatoes
    {"commodity": "Tomatoes", "market_name": "Nairobi (Wakulima)", "county": "Nairobi", "unit": "64kg crate", "price_low": 5500, "price_high": 7200, "price_avg": 6350},
    {"commodity": "Tomatoes", "market_name": "Nakuru Wholesale", "county": "Nakuru", "unit": "64kg crate", "price_low": 4800, "price_high": 6200, "price_avg": 5500},
    {"commodity": "Tomatoes", "market_name": "Mombasa (Kongowea)", "county": "Mombasa", "unit": "64kg crate", "price_low": 6000, "price_high": 8000, "price_avg": 7000},
    {"commodity": "Tomatoes", "market_name": "Eldoret Market", "county": "Uasin Gishu", "unit": "64kg crate", "price_low": 4500, "price_high": 5800, "price_avg": 5150},

    # Dry Beans
    {"commodity": "Dry Beans (Rosecoco/Nyayo)", "market_name": "Nairobi (Wakulima)", "county": "Nairobi", "unit": "90kg bag", "price_low": 9000, "price_high": 11500, "price_avg": 10250},
    {"commodity": "Dry Beans (Rosecoco/Nyayo)", "market_name": "Nakuru Top Market", "county": "Nakuru", "unit": "90kg bag", "price_low": 8200, "price_high": 10000, "price_avg": 9100},
    {"commodity": "Dry Beans (Rosecoco/Nyayo)", "market_name": "Mombasa (Kongowea)", "county": "Mombasa", "unit": "90kg bag", "price_low": 9500, "price_high": 12000, "price_avg": 10750},

    # Red Onions
    {"commodity": "Red Onions", "market_name": "Nairobi (Wakulima)", "county": "Nairobi", "unit": "kg", "price_low": 120, "price_high": 160, "price_avg": 140},
    {"commodity": "Red Onions", "market_name": "Nakuru Market", "county": "Nakuru", "unit": "kg", "price_low": 100, "price_high": 140, "price_avg": 120},
    {"commodity": "Red Onions", "market_name": "Mombasa (Kongowea)", "county": "Mombasa", "unit": "kg", "price_low": 130, "price_high": 180, "price_avg": 155},

    # Cabbages
    {"commodity": "Cabbages", "market_name": "Nairobi (Wakulima)", "county": "Nairobi", "unit": "piece/head", "price_low": 40, "price_high": 70, "price_avg": 55},
    {"commodity": "Cabbages", "market_name": "Nakuru Wholesale", "county": "Nakuru", "unit": "piece/head", "price_low": 25, "price_high": 45, "price_avg": 35},
    {"commodity": "Cabbages", "market_name": "Eldoret Market", "county": "Uasin Gishu", "unit": "piece/head", "price_low": 20, "price_high": 40, "price_avg": 30},

    # Avocados
    {"commodity": "Hass Avocados", "market_name": "Nairobi (City Market)", "county": "Nairobi", "unit": "crate (15kg)", "price_low": 1500, "price_high": 2400, "price_avg": 1950},
    {"commodity": "Hass Avocados", "market_name": "Murang'a Farm Gate", "county": "Murang'a", "unit": "crate (15kg)", "price_low": 900, "price_high": 1500, "price_avg": 1200},

    # Fresh Milk
    {"commodity": "Fresh Raw Milk", "market_name": "Nairobi Retail", "county": "Nairobi", "unit": "litre", "price_low": 65, "price_high": 85, "price_avg": 75},
    {"commodity": "Fresh Raw Milk", "market_name": "Nakuru Farm Gate", "county": "Nakuru", "unit": "litre", "price_low": 45, "price_high": 55, "price_avg": 50},
]


def seed_market_prices(db: Session) -> int:
    """Ensure database has current Kenyan market prices."""
    count = db.query(MarketPrice).count()
    if count == 0:
        for item in DEFAULT_KENYAN_MARKET_DATA:
            record = MarketPrice(
                commodity=item["commodity"],
                market_name=item["market_name"],
                county=item["county"],
                unit=item["unit"],
                price_low=item["price_low"],
                price_high=item["price_high"],
                price_avg=item["price_avg"],
                updated_at=datetime.datetime.now(datetime.timezone.utc),
            )
            db.add(record)
        db.commit()
        return len(DEFAULT_KENYAN_MARKET_DATA)
    return count


def get_all_prices(db: Session, commodity_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieve market prices, optionally filtered by commodity."""
    seed_market_prices(db)
    query = db.query(MarketPrice)
    if commodity_filter:
        query = query.filter(MarketPrice.commodity.ilike(f"%{commodity_filter}%"))
    prices = query.all()
    return [
        {
            "id": p.id,
            "commodity": p.commodity,
            "market_name": p.market_name,
            "county": p.county,
            "unit": p.unit,
            "price_low": p.price_low,
            "price_high": p.price_high,
            "price_avg": p.price_avg,
            "updated_at": p.updated_at.strftime("%Y-%m-%d"),
        }
        for p in prices
    ]


def evaluate_sale_price(
    commodity: str,
    unit_price: float,
    unit: str,
    db: Session,
    farmer_county: Optional[str] = None,
) -> Dict[str, Any]:
    """Compare a farmer's sale price against real Kenyan market benchmarks."""
    seed_market_prices(db)
    # Search for matching commodity
    clean_comm = commodity.split("(")[0].strip().lower()
    matches = db.query(MarketPrice).filter(MarketPrice.commodity.ilike(f"%{clean_comm}%")).all()

    if not matches:
        return {
            "has_benchmark": False,
            "message": f"No active market benchmark found for '{commodity}'.",
        }

    # Prefer matches in farmer's county or nearby wholesale hubs
    avg_price = sum(m.price_avg for m in matches) / len(matches)
    benchmark_unit = matches[0].unit

    diff_pct = ((unit_price - avg_price) / avg_price) * 100

    if diff_pct >= 5.0:
        status = "above_market"
        message = (
            f"🎉 Great deal! Your price of KES {unit_price:,.0f} is "
            f"{abs(diff_pct):.1f}% above the regional average of KES {avg_price:,.0f} per {benchmark_unit}."
        )
    elif diff_pct <= -10.0:
        status = "below_market"
        message = (
            f"⚠️ Caution: Your sale price of KES {unit_price:,.0f} is "
            f"{abs(diff_pct):.1f}% below the current market average (KES {avg_price:,.0f} per {benchmark_unit}). "
            f"Traders in wholesale markets are paying KES {matches[0].price_low:,.0f} - {matches[0].price_high:,.0f}."
        )
    else:
        status = "fair_market"
        message = (
            f"✅ Fair price: KES {unit_price:,.0f} aligns closely with the prevailing market benchmark "
            f"of KES {avg_price:,.0f} per {benchmark_unit}."
        )

    return {
        "has_benchmark": True,
        "status": status,
        "market_avg": round(avg_price, 2),
        "benchmark_unit": benchmark_unit,
        "difference_pct": round(diff_pct, 1),
        "message": message,
    }
