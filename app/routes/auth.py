import json
import logging
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import DiseaseScan, Farmer, LedgerTransaction, utc_now
from app.services.gemma import GemmaUnavailable, ask_gemma_json
from app.services.weather import KENYA_COUNTY_COORDINATES

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["Farmer Profile & Kilimo-Trust-Index"])

TRUST_INDEX_PROMPT_PATH = Path(__file__).resolve().parent.parent.parent / "prompts" / "trust_index.txt"

ALL_KENYAN_COUNTIES = sorted(list(KENYA_COUNTY_COORDINATES.keys()) + [
    "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu", "Garissa",
    "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho", "Kiambu", "Kilifi",
    "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia", "Lamu", "Machakos",
    "Makueni", "Mandera", "Marsabit", "Meru", "Migori", "Mombasa", "Murang'a",
    "Nairobi", "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua", "Nyeri",
    "Samburu", "Siaya", "Taita-Taveta", "Tana River", "Tharaka-Nithi", "Trans Nzoia",
    "Turkana", "Uasin Gishu", "Vihiga", "Wajir", "West Pokot"
])
ALL_KENYAN_COUNTIES = sorted(list(set(ALL_KENYAN_COUNTIES)))


def load_trust_index_prompt() -> str:
    return TRUST_INDEX_PROMPT_PATH.read_text(encoding="utf-8").strip()


class FarmerProfileRequest(BaseModel):
    name: str
    phone: str
    county: str = "Nakuru"
    sub_county: Optional[str] = ""
    primary_crop: Optional[str] = "Maize"
    crops: Optional[List[str]] = []
    farm_size_acres: Optional[float] = 1.0
    is_sacco_member: Optional[str] = "no"
    sacco_name: Optional[str] = None
    sacco_member_id: Optional[str] = None


class FarmerProfileResponse(BaseModel):
    id: int
    name: str
    phone: str
    county: str
    sub_county: Optional[str] = ""
    primary_crop: str
    crops: List[str]
    farm_size_acres: float
    is_sacco_member: str
    sacco_name: Optional[str] = None
    sacco_member_id: Optional[str] = None
    trust_index_score: Optional[int] = None
    trust_index_grade: Optional[str] = None
    trust_index_risk: Optional[str] = None
    trust_index_max_credit: Optional[float] = None
    trust_index_summary: Optional[str] = None
    trust_index_updated_at: Optional[str] = None


@router.get("/counties", response_model=List[str])
def get_counties():
    """Return list of all Kenyan counties."""
    return ALL_KENYAN_COUNTIES


@router.post("/farmer/profile", response_model=FarmerProfileResponse)
def save_or_login_farmer(payload: FarmerProfileRequest, db: Session = Depends(get_db)):
    """Log in an existing farmer by phone number or register a new one with detailed profile data."""
    phone = payload.phone.strip()
    name = payload.name.strip()
    county = payload.county.strip()
    sub_county = (payload.sub_county or "").strip()
    primary_crop = (payload.primary_crop or "Maize").strip()
    crops_list = [c.strip() for c in (payload.crops or []) if c.strip()]
    if not crops_list:
        crops_list = [primary_crop]
    crops_str = ", ".join(crops_list)
    farm_size_acres = float(payload.farm_size_acres or 1.0)
    is_sacco_member = payload.is_sacco_member or "no"
    sacco_name = payload.sacco_name.strip() if payload.sacco_name else None
    sacco_member_id = payload.sacco_member_id.strip() if payload.sacco_member_id else None

    if not phone or not name:
        raise HTTPException(status_code=400, detail="Name and phone number are required.")

    farmer = db.query(Farmer).filter(Farmer.phone == phone).first()
    if not farmer:
        farmer = Farmer(
            name=name,
            phone=phone,
            county=county,
            sub_county=sub_county,
            primary_crop=primary_crop,
            crops=crops_str,
            farm_size_acres=farm_size_acres,
            is_sacco_member=is_sacco_member,
            sacco_name=sacco_name,
            sacco_member_id=sacco_member_id,
        )
        db.add(farmer)
        db.commit()
        db.refresh(farmer)
    else:
        # Update details if changed
        farmer.name = name
        farmer.county = county
        farmer.sub_county = sub_county
        farmer.primary_crop = primary_crop
        farmer.crops = crops_str
        farmer.farm_size_acres = farm_size_acres
        farmer.is_sacco_member = is_sacco_member
        farmer.sacco_name = sacco_name
        farmer.sacco_member_id = sacco_member_id
        db.commit()
        db.refresh(farmer)

    parsed_crops = [c.strip() for c in (farmer.crops or "").split(",") if c.strip()]

    return FarmerProfileResponse(
        id=farmer.id,
        name=farmer.name,
        phone=farmer.phone,
        county=farmer.county,
        sub_county=farmer.sub_county or "",
        primary_crop=farmer.primary_crop,
        crops=parsed_crops or [farmer.primary_crop],
        farm_size_acres=farmer.farm_size_acres or 1.0,
        is_sacco_member=farmer.is_sacco_member or "no",
        sacco_name=farmer.sacco_name,
        sacco_member_id=farmer.sacco_member_id,
        trust_index_score=farmer.trust_index_score,
        trust_index_grade=farmer.trust_index_grade,
        trust_index_risk=farmer.trust_index_risk,
        trust_index_max_credit=farmer.trust_index_max_credit,
        trust_index_summary=farmer.trust_index_summary,
        trust_index_updated_at=farmer.trust_index_updated_at.strftime("%Y-%m-%d %H:%M") if farmer.trust_index_updated_at else None,
    )


@router.get("/farmer/{farmer_id}")
def get_farmer_profile(farmer_id: int, db: Session = Depends(get_db)):
    """Fetch farmer profile and financial snapshot."""
    farmer = db.query(Farmer).filter(Farmer.id == farmer_id).first()
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found.")

    incomes = (
        db.query(LedgerTransaction)
        .filter(LedgerTransaction.farmer_id == farmer_id, LedgerTransaction.transaction_type == "income")
        .all()
    )
    expenses = (
        db.query(LedgerTransaction)
        .filter(LedgerTransaction.farmer_id == farmer_id, LedgerTransaction.transaction_type == "expense")
        .all()
    )

    total_income = sum(t.total_amount for t in incomes)
    total_expense = sum(t.total_amount for t in expenses)
    net_profit = total_income - total_expense

    parsed_crops = [c.strip() for c in (farmer.crops or "").split(",") if c.strip()]

    return {
        "id": farmer.id,
        "name": farmer.name,
        "phone": farmer.phone,
        "county": farmer.county,
        "sub_county": farmer.sub_county or "",
        "primary_crop": farmer.primary_crop,
        "crops": parsed_crops or [farmer.primary_crop],
        "farm_size_acres": farmer.farm_size_acres or 1.0,
        "is_sacco_member": farmer.is_sacco_member or "no",
        "sacco_name": farmer.sacco_name,
        "sacco_member_id": farmer.sacco_member_id,
        "trust_index": {
            "score": farmer.trust_index_score,
            "grade": farmer.trust_index_grade,
            "risk_level": farmer.trust_index_risk,
            "max_credit_kes": farmer.trust_index_max_credit,
            "summary": farmer.trust_index_summary,
            "details": json.loads(farmer.trust_index_details_json) if farmer.trust_index_details_json else None,
            "updated_at": farmer.trust_index_updated_at.strftime("%Y-%m-%d %H:%M") if farmer.trust_index_updated_at else None,
        },
        "financial_summary": {
            "total_income_kes": total_income,
            "total_expense_kes": total_expense,
            "net_profit_kes": net_profit,
            "transaction_count": len(incomes) + len(expenses),
        },
    }


@router.post("/farmer/{farmer_id}/trust-index")
def generate_trust_index(farmer_id: int, db: Session = Depends(get_db)):
    """Generate or recalculate Kilimo-Trust-Index informal credit rating using Google Gemma."""
    farmer = db.query(Farmer).filter(Farmer.id == farmer_id).first()
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found.")

    # Aggregate financial transactions
    transactions = (
        db.query(LedgerTransaction)
        .filter(LedgerTransaction.farmer_id == farmer_id)
        .order_by(LedgerTransaction.created_at.desc())
        .limit(30)
        .all()
    )
    incomes = [t for t in transactions if t.transaction_type == "income"]
    expenses = [t for t in transactions if t.transaction_type == "expense"]

    total_income = sum(t.total_amount for t in incomes)
    total_expense = sum(t.total_amount for t in expenses)
    net_profit = total_income - total_expense

    sold_commodities = list(set(t.commodity for t in incomes))
    scans = (
        db.query(DiseaseScan)
        .filter(DiseaseScan.farmer_id == farmer_id)
        .order_by(DiseaseScan.created_at.desc())
        .limit(10)
        .all()
    )

    system_prompt = load_trust_index_prompt()

    user_prompt = f"""
Farmer Operational & Financial Profile for Credit Risk Assessment:
- Name: {farmer.name}
- County: {farmer.county} (Sub-County: {farmer.sub_county or 'Central'})
- Farm Size: {farmer.farm_size_acres or 1.0} Acres
- Crops Cultivated: {farmer.crops or farmer.primary_crop}
- SACCO / Cooperative Member: {'YES - ' + (farmer.sacco_name or 'Agricultural SACCO') + ' (Member ID: ' + (farmer.sacco_member_id or 'Verified') + ')' if farmer.is_sacco_member == 'yes' else 'NO - Informal smallholder'}
- Verified Sales Revenue: KES {total_income:,.0f} across {len(incomes)} recorded sale(s)
- Operating Farm Expenses: KES {total_expense:,.0f} across {len(expenses)} expense transaction(s)
- Net Farm Profit: KES {net_profit:,.0f}
- Primary Commodities Sold: {', '.join(sold_commodities) if sold_commodities else 'None logged yet'}
- Crop Disease Scans Performed: {len(scans)} diagnostic scan(s) logged in KilimoGuard

Please generate the Kilimo-Trust-Index informal credit assessment score, grade, risk rating, and underwriting recommendations for SACCOs.
"""

    try:
        data, answer = ask_gemma_json(prompt=user_prompt, system_prompt=system_prompt)
    except GemmaUnavailable:
        raise HTTPException(status_code=503, detail="Gemma AI credit evaluator is busy. Please try again in a moment.")
    except Exception as exc:
        log.exception("Trust index calculation failed: %s", exc)
        raise HTTPException(status_code=502, detail="Unable to compute Kilimo-Trust-Index at this time.")

    score = int(data.get("score", 650) or 650)
    # Bound score strictly between 300 and 850
    score = max(300, min(850, score))
    grade = str(data.get("grade", "BBB"))
    risk_level = str(data.get("risk_level", "Moderate Risk"))
    max_credit = float(data.get("max_recommended_credit_kes", 50000.0) or 50000.0)
    summary = str(data.get("financial_health_summary", "Healthy smallholder profile with verified ledger records."))

    # Save to database
    farmer.trust_index_score = score
    farmer.trust_index_grade = grade
    farmer.trust_index_risk = risk_level
    farmer.trust_index_max_credit = max_credit
    farmer.trust_index_summary = summary
    farmer.trust_index_details_json = json.dumps(data)
    farmer.trust_index_updated_at = utc_now()
    db.commit()
    db.refresh(farmer)

    return {
        "status": "success",
        "farmer_id": farmer.id,
        "farmer_name": farmer.name,
        "score": score,
        "grade": grade,
        "risk_level": risk_level,
        "max_recommended_credit_kes": max_credit,
        "repayment_capacity": data.get("repayment_capacity", "Adequate"),
        "financial_health_summary": summary,
        "key_strengths": data.get("key_strengths", []),
        "risk_factors": data.get("risk_factors", []),
        "recommendations_for_sacco": data.get("recommendations_for_sacco", ""),
        "agronomic_resilience": data.get("agronomic_resilience", ""),
        "updated_at": farmer.trust_index_updated_at.strftime("%Y-%m-%d %H:%M"),
        "model_used": answer.model,
    }


@router.get("/farmer/{farmer_id}/trust-index")
def get_trust_index(farmer_id: int, db: Session = Depends(get_db)):
    """Retrieve existing cached Kilimo-Trust-Index."""
    farmer = db.query(Farmer).filter(Farmer.id == farmer_id).first()
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found.")

    if not farmer.trust_index_score:
        return {"has_score": False, "message": "No Kilimo-Trust-Index calculated yet."}

    details = json.loads(farmer.trust_index_details_json) if farmer.trust_index_details_json else {}

    return {
        "has_score": True,
        "score": farmer.trust_index_score,
        "grade": farmer.trust_index_grade,
        "risk_level": farmer.trust_index_risk,
        "max_recommended_credit_kes": farmer.trust_index_max_credit,
        "repayment_capacity": details.get("repayment_capacity", "Adequate"),
        "financial_health_summary": farmer.trust_index_summary,
        "key_strengths": details.get("key_strengths", []),
        "risk_factors": details.get("risk_factors", []),
        "recommendations_for_sacco": details.get("recommendations_for_sacco", ""),
        "agronomic_resilience": details.get("agronomic_resilience", ""),
        "updated_at": farmer.trust_index_updated_at.strftime("%Y-%m-%d %H:%M") if farmer.trust_index_updated_at else "",
    }
