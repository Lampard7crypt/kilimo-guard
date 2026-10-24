import logging
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import DiseaseScan
from app.services.gemma import GemmaUnavailable, ask_gemma_json
from app.services.storage import save_upload

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/scan", tags=["Crop Disease Scanning"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB
PROMPT_PATH = Path(__file__).resolve().parent.parent.parent / "prompts" / "disease_diagnosis.txt"


def load_diagnosis_prompt() -> str:
    return PROMPT_PATH.read_text(encoding="utf-8").strip()


@router.post("/disease")
def scan_crop_disease(
    image: UploadFile = File(...),
    farmer_id: Optional[int] = Form(None),
    crop_hint: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """Scan a crop leaf/stem photo for diseases, store photo in DigitalOcean Spaces, and diagnose via Gemma."""
    if not image.filename:
        raise HTTPException(status_code=400, detail="Please select an image to upload.")

    content_type = image.content_type or "image/jpeg"
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Unsupported file format. Please upload a JPEG, PNG, or WebP photo.",
        )

    file_bytes = image.file.read(MAX_IMAGE_BYTES + 1)
    if len(file_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image too large. Maximum size is {MAX_IMAGE_BYTES // (1024 * 1024)} MB.",
        )

    # 1. Archive image to DigitalOcean Spaces (or local fallback)
    public_url, local_path = save_upload(
        file_bytes=file_bytes,
        original_filename=image.filename,
        folder="scans",
        content_type=content_type,
    )

    # 2. Invoke Gemma with plant pathologist prompt
    system_prompt = load_diagnosis_prompt()
    user_query = "Please examine this crop photo. Identify the crop and any disease, pests, or deficiencies."
    if crop_hint:
        user_query += f" The farmer indicates this may be {crop_hint}."

    try:
        data, answer = ask_gemma_json(
            prompt=user_query,
            media_path=local_path,
            system_prompt=system_prompt,
        )
    except GemmaUnavailable:
        raise HTTPException(
            status_code=503,
            detail="Gemma diagnostic AI is currently busy. Please retry in a few seconds.",
        )
    except Exception as exc:
        log.exception("Disease scan inference failed: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="Gemma AI was unable to complete the image diagnosis. Please try again with a clearer photo.",
        )

    # 3. Save diagnosis in database
    scan_record = DiseaseScan(
        farmer_id=farmer_id,
        image_url=public_url,
        crop=data.get("crop", "Unknown"),
        diagnosis=data.get("diagnosis", "Unidentifiable Crop/Specimen"),
        confidence=data.get("confidence", "Medium"),
        symptoms=data.get("symptoms", ""),
        organic_treatment=data.get("organic_treatment", ""),
        chemical_treatment=data.get("chemical_treatment", ""),
        prevention=data.get("prevention", ""),
        raw_response=answer.text,
    )
    db.add(scan_record)
    db.commit()
    db.refresh(scan_record)

    return {
        "id": scan_record.id,
        "image_url": public_url,
        "crop": scan_record.crop,
        "diagnosis": scan_record.diagnosis,
        "confidence": scan_record.confidence,
        "symptoms": scan_record.symptoms,
        "organic_treatment": scan_record.organic_treatment,
        "chemical_treatment": scan_record.chemical_treatment,
        "prevention": scan_record.prevention,
        "model_used": answer.model,
        "created_at": scan_record.created_at.strftime("%Y-%m-%d %H:%M"),
    }


@router.get("/history")
def get_scan_history(farmer_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Retrieve historical disease scans."""
    query = db.query(DiseaseScan)
    if farmer_id:
        query = query.filter(DiseaseScan.farmer_id == farmer_id)
    scans = query.order_by(DiseaseScan.created_at.desc()).limit(20).all()

    return [
        {
            "id": s.id,
            "image_url": s.image_url,
            "crop": s.crop,
            "diagnosis": s.diagnosis,
            "confidence": s.confidence,
            "symptoms": s.symptoms,
            "organic_treatment": s.organic_treatment,
            "chemical_treatment": s.chemical_treatment,
            "prevention": s.prevention,
            "created_at": s.created_at.strftime("%Y-%m-%d %H:%M"),
        }
        for s in scans
    ]


@router.post("/receipt")
def scan_receipt_alias(
    receipt: Optional[UploadFile] = File(None),
    image: Optional[UploadFile] = File(None),
    farmer_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
):
    """Alias for receipt scanning under /api/scan/receipt."""
    from app.routes.ledger import scan_receipt
    return scan_receipt(receipt=receipt, image=image, farmer_id=farmer_id, db=db)
