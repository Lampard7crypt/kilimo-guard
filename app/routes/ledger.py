import logging
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import LedgerTransaction
from app.services.gemma import GemmaUnavailable, ask_gemma_json
from app.services.storage import save_upload

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ledger", tags=["Digital Ledger & Receipts"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024
RECEIPT_PROMPT_PATH = Path(__file__).resolve().parent.parent.parent / "prompts" / "receipt_parser.txt"


def load_receipt_prompt() -> str:
    return RECEIPT_PROMPT_PATH.read_text(encoding="utf-8").strip()


class AcceptTransactionRequest(BaseModel):
    farmer_id: Optional[int] = None
    transaction_type: str = "expense"  # "expense" or "income"
    category: str = "Fertilizer"
    commodity: str
    quantity: float = 1.0
    unit: str = "units"
    unit_price: float
    total_amount: float
    counterparty: Optional[str] = None
    receipt_url: Optional[str] = None
    notes: Optional[str] = None


@router.post("/receipt/scan")
@router.post("/receipt")
def scan_receipt(
    receipt: Optional[UploadFile] = File(None),
    image: Optional[UploadFile] = File(None),
    farmer_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
):
    """Scan an agrovet receipt, upload to DigitalOcean Spaces, parse line items with Gemma, and return draft preview."""
    file_to_scan = receipt or image
    if not file_to_scan or not file_to_scan.filename:
        raise HTTPException(status_code=400, detail="Please upload a receipt image.")

    content_type = file_to_scan.content_type or "image/jpeg"
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Unsupported image format. Please upload JPEG, PNG, or WebP.",
        )

    file_bytes = file_to_scan.file.read(MAX_IMAGE_BYTES + 1)
    if len(file_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image too large. Maximum size is {MAX_IMAGE_BYTES // (1024 * 1024)} MB.",
        )

    # 1. Archive to DigitalOcean Spaces
    receipt_url, local_path = save_upload(
        file_bytes=file_bytes,
        original_filename=file_to_scan.filename,
        folder="receipts",
        content_type=content_type,
    )

    # 2. Invoke Gemma with receipt parser system prompt
    system_prompt = load_receipt_prompt()
    user_query = "Please audit and extract the financial data, items, and total amount from this receipt."

    try:
        data, answer = ask_gemma_json(
            prompt=user_query,
            media_path=local_path,
            system_prompt=system_prompt,
        )
    except GemmaUnavailable:
        raise HTTPException(
            status_code=503,
            detail="Gemma OCR engine is busy right now. Please retry in a moment.",
        )
    except Exception as exc:
        log.exception("Receipt extraction failed: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="Unable to parse the receipt image. Please verify image clarity.",
        )

    total_amt = float(data.get("total_amount", 0.0) or 0.0)
    qty = float(data.get("quantity", 1.0) or 1.0)
    unit_p = float(data.get("unit_price", 0.0) or (total_amt / qty if qty > 0 else total_amt))
    vendor_name = data.get("vendor", "Agrovet Shop")
    receipt_date = data.get("date", "")
    raw_items = data.get("items", [])

    line_items = []
    for it in raw_items:
        it_name = it.get("name", it.get("item_name", "Supply Item"))
        it_qty = it.get("quantity", 1)
        it_up = it.get("unit_price", 0)
        it_tot = it.get("total", it.get("total_price", (it_qty * it_up) if it_up else 0))
        line_items.append({
            "item_name": it_name,
            "quantity": it_qty,
            "unit_price": it_up,
            "total_price": it_tot,
        })

    draft_preview = {
        "farmer_id": farmer_id,
        "transaction_type": "expense",
        "category": data.get("category", "Fertilizer"),
        "commodity": data.get("commodity", "Farm Supplies"),
        "quantity": qty,
        "unit": data.get("unit", "units"),
        "unit_price": unit_p,
        "total_amount": total_amt,
        "counterparty": vendor_name,
        "merchant_name": vendor_name,
        "date": receipt_date,
        "receipt_url": receipt_url,
        "items": raw_items,
        "line_items": line_items,
        "summary": data.get("summary", "Scanned farm expense receipt."),
        "model_used": answer.model,
    }

    return draft_preview


@router.post("/accept")
@router.post("/transaction")
def accept_transaction(payload: AcceptTransactionRequest, db: Session = Depends(get_db)):
    """Save an accepted draft transaction into the permanent ledger."""
    transaction = LedgerTransaction(
        farmer_id=payload.farmer_id,
        transaction_type=payload.transaction_type,
        category=payload.category,
        commodity=payload.commodity,
        quantity=payload.quantity,
        unit=payload.unit,
        unit_price=payload.unit_price,
        total_amount=payload.total_amount,
        counterparty=payload.counterparty,
        receipt_url=payload.receipt_url,
        notes=payload.notes,
        status="accepted",
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)

    return {
        "status": "success",
        "message": f"Successfully recorded {transaction.transaction_type} of KES {transaction.total_amount:,.0f} in your digital ledger.",
        "transaction_id": transaction.id,
        "transaction": {
            "id": transaction.id,
            "type": transaction.transaction_type,
            "category": transaction.category,
            "commodity": transaction.commodity,
            "quantity": transaction.quantity,
            "unit": transaction.unit,
            "unit_price": transaction.unit_price,
            "total_amount": transaction.total_amount,
            "counterparty": transaction.counterparty,
            "receipt_url": transaction.receipt_url,
            "created_at": transaction.created_at.strftime("%Y-%m-%d %H:%M"),
        },
    }


@router.get("/transactions")
def get_transactions(
    farmer_id: Optional[int] = None,
    transaction_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Retrieve farmer transaction ledger history."""
    query = db.query(LedgerTransaction)
    if farmer_id:
        query = query.filter(LedgerTransaction.farmer_id == farmer_id)
    if transaction_type:
        query = query.filter(LedgerTransaction.transaction_type == transaction_type)

    records = query.order_by(LedgerTransaction.created_at.desc()).all()

    return [
        {
            "id": r.id,
            "transaction_type": r.transaction_type,
            "category": r.category,
            "commodity": r.commodity,
            "quantity": r.quantity,
            "unit": r.unit,
            "unit_price": r.unit_price,
            "total_amount": r.total_amount,
            "counterparty": r.counterparty,
            "receipt_url": r.receipt_url,
            "notes": r.notes,
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M"),
        }
        for r in records
    ]


@router.get("/summary")
def get_ledger_summary(farmer_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Calculate aggregate income, expenses, and net profit margins."""
    query = db.query(LedgerTransaction)
    if farmer_id:
        query = query.filter(LedgerTransaction.farmer_id == farmer_id)

    records = query.all()

    total_income = sum(r.total_amount for r in records if r.transaction_type == "income")
    total_expense = sum(r.total_amount for r in records if r.transaction_type == "expense")
    net_profit = total_income - total_expense

    # Category breakdowns
    expense_by_category = {}
    income_by_category = {}
    for r in records:
        cat = r.category or "Other"
        if r.transaction_type == "expense":
            expense_by_category[cat] = expense_by_category.get(cat, 0.0) + r.total_amount
        else:
            income_by_category[cat] = income_by_category.get(cat, 0.0) + r.total_amount

    return {
        "total_income_kes": total_income,
        "total_expense_kes": total_expense,
        "net_profit_kes": net_profit,
        "total_transactions": len(records),
        "expense_breakdown": expense_by_category,
        "income_breakdown": income_by_category,
    }


@router.delete("/transaction/{transaction_id}")
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    """Remove a ledger transaction."""
    record = db.query(LedgerTransaction).filter(LedgerTransaction.id == transaction_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    db.delete(record)
    db.commit()
    return {"status": "success", "message": "Transaction deleted."}
