import datetime
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


def utc_now():
    return datetime.datetime.now(datetime.timezone.utc)


class Farmer(Base):
    __tablename__ = "farmers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    phone = Column(String(50), unique=True, index=True, nullable=False)
    county = Column(String(80), nullable=False, default="Nakuru")
    sub_county = Column(String(100), default="")
    primary_crop = Column(String(100), default="Maize")
    crops = Column(String(300), default="Maize")
    farm_size_acres = Column(Float, default=1.0)
    is_sacco_member = Column(String(10), default="no")
    sacco_name = Column(String(150), nullable=True)
    sacco_member_id = Column(String(100), nullable=True)

    # Kilimo-Trust-Index (Credit & Operational Health Rating)
    trust_index_score = Column(Integer, nullable=True)
    trust_index_grade = Column(String(10), nullable=True)
    trust_index_risk = Column(String(40), nullable=True)
    trust_index_max_credit = Column(Float, nullable=True)
    trust_index_summary = Column(Text, nullable=True)
    trust_index_details_json = Column(Text, nullable=True)
    trust_index_updated_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=utc_now)

    scans = relationship("DiseaseScan", back_populates="farmer", cascade="all, delete-orphan")
    transactions = relationship("LedgerTransaction", back_populates="farmer", cascade="all, delete-orphan")


class DiseaseScan(Base):
    __tablename__ = "disease_scans"

    id = Column(Integer, primary_key=True, index=True)
    farmer_id = Column(Integer, ForeignKey("farmers.id"), nullable=True)
    image_url = Column(String(500), nullable=False)
    crop = Column(String(100), nullable=False)
    diagnosis = Column(String(150), nullable=False)
    confidence = Column(String(50), default="High")
    symptoms = Column(Text, nullable=True)
    organic_treatment = Column(Text, nullable=True)
    chemical_treatment = Column(Text, nullable=True)
    prevention = Column(Text, nullable=True)
    raw_response = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    farmer = relationship("Farmer", back_populates="scans")


class LedgerTransaction(Base):
    __tablename__ = "ledger_transactions"

    id = Column(Integer, primary_key=True, index=True)
    farmer_id = Column(Integer, ForeignKey("farmers.id"), nullable=True)
    transaction_type = Column(String(20), nullable=False)  # "income" or "expense"
    category = Column(String(80), nullable=False)          # e.g., "Crop Sale", "Fertilizer", "Seed", "Labor"
    commodity = Column(String(120), nullable=False)         # e.g., "Maize (Dry)", "DAP Fertilizer", "Irish Potatoes"
    quantity = Column(Float, default=1.0)
    unit = Column(String(50), default="units")             # e.g., "bag (90kg)", "crate", "kg"
    unit_price = Column(Float, nullable=False)             # In KES
    total_amount = Column(Float, nullable=False)           # In KES
    counterparty = Column(String(120), nullable=True)      # Buyer name or Agrovet shop
    receipt_url = Column(String(500), nullable=True)       # DigitalOcean Spaces URL or local URL
    notes = Column(Text, nullable=True)
    status = Column(String(20), default="accepted")        # "draft" or "accepted"
    created_at = Column(DateTime, default=utc_now)

    farmer = relationship("Farmer", back_populates="transactions")


class MarketPrice(Base):
    __tablename__ = "market_prices"

    id = Column(Integer, primary_key=True, index=True)
    commodity = Column(String(100), index=True, nullable=False)
    market_name = Column(String(100), nullable=False)  # "Wakulima (Nairobi)", "Kongowea (Mombasa)", etc.
    county = Column(String(80), nullable=False)
    unit = Column(String(50), nullable=False)          # "90kg Bag", "50kg Bag", "Crate", "Kg"
    price_low = Column(Float, nullable=False)          # In KES
    price_high = Column(Float, nullable=False)         # In KES
    price_avg = Column(Float, nullable=False)          # In KES
    updated_at = Column(DateTime, default=utc_now)
