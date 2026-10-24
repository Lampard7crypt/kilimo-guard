from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Farmer, LedgerTransaction
from app.services.weather import KENYA_COUNTY_COORDINATES

router = APIRouter(prefix="/api", tags=["Farmer Profile"])

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


class FarmerProfileRequest(BaseModel):
    name: str
    phone: str
    county: str = "Nakuru"
    primary_crop: str = "Maize"


class FarmerProfileResponse(BaseModel):
    id: int
    name: str
    phone: str
    county: str
    primary_crop: str


@router.get("/counties", response_model=List[str])
def get_counties():
    """Return list of all Kenyan counties."""
    return ALL_KENYAN_COUNTIES


@router.post("/farmer/profile", response_model=FarmerProfileResponse)
def save_or_login_farmer(payload: FarmerProfileRequest, db: Session = Depends(get_db)):
    """Log in an existing farmer by phone number or register a new one."""
    phone = payload.phone.strip()
    name = payload.name.strip()
    county = payload.county.strip()
    primary_crop = payload.primary_crop.strip()

    if not phone or not name:
        raise HTTPException(status_code=400, detail="Name and phone number are required.")

    farmer = db.query(Farmer).filter(Farmer.phone == phone).first()
    if not farmer:
        farmer = Farmer(
            name=name,
            phone=phone,
            county=county,
            primary_crop=primary_crop,
        )
        db.add(farmer)
        db.commit()
        db.refresh(farmer)
    else:
        # Update details if changed
        farmer.name = name
        farmer.county = county
        farmer.primary_crop = primary_crop
        db.commit()
        db.refresh(farmer)

    return FarmerProfileResponse(
        id=farmer.id,
        name=farmer.name,
        phone=farmer.phone,
        county=farmer.county,
        primary_crop=farmer.primary_crop,
    )


@router.get("/farmer/{farmer_id}")
def get_farmer_profile(farmer_id: int, db: Session = Depends(get_db)):
    """Fetch farmer profile and financial snapshot."""
    farmer = db.query(Farmer).filter(Farmer.id == farmer_id).first()
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found.")

    # Calculate financial snapshot
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

    return {
        "id": farmer.id,
        "name": farmer.name,
        "phone": farmer.phone,
        "county": farmer.county,
        "primary_crop": farmer.primary_crop,
        "financial_summary": {
            "total_income_kes": total_income,
            "total_expense_kes": total_expense,
            "net_profit_kes": net_profit,
            "transaction_count": len(incomes) + len(expenses),
        },
    }
