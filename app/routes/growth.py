import datetime
import json
import logging
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import CropBatch, Farmer, GrowthLog
from app.services.gemma import GemmaUnavailable, ask_gemma_json
from app.services.storage import save_upload

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/growth", tags=["Crop Growth & Phenology Tracking"])

GROWTH_PROMPT_PATH = Path(__file__).resolve().parent.parent.parent / "prompts" / "growth_tracker.txt"
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024


def load_growth_prompt() -> str:
    return GROWTH_PROMPT_PATH.read_text(encoding="utf-8").strip()


class CreateCropBatchRequest(BaseModel):
    farmer_id: int
    name: str
    crop: str
    variety: Optional[str] = None
    acreage: float = 1.0
    planting_date: str  # YYYY-MM-DD


@router.post("/batch")
def create_crop_batch(payload: CreateCropBatchRequest, db: Session = Depends(get_db)):
    """Register a new farm plot or crop batch to track through its growth stages."""
    farmer = db.query(Farmer).filter(Farmer.id == payload.farmer_id).first()
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found.")

    batch = CropBatch(
        farmer_id=payload.farmer_id,
        name=payload.name.strip(),
        crop=payload.crop.strip(),
        variety=payload.variety.strip() if payload.variety else None,
        acreage=payload.acreage,
        planting_date=payload.planting_date.strip(),
        status="active",
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    return {
        "id": batch.id,
        "name": batch.name,
        "crop": batch.crop,
        "variety": batch.variety,
        "acreage": batch.acreage,
        "planting_date": batch.planting_date,
        "status": batch.status,
    }


@router.get("/batches")
def list_crop_batches(farmer_id: int, db: Session = Depends(get_db)):
    """List all tracked crop plots and their latest phenology stage."""
    batches = (
        db.query(CropBatch)
        .filter(CropBatch.farmer_id == farmer_id)
        .order_by(CropBatch.created_at.desc())
        .all()
    )

    result = []
    for b in batches:
        latest_log = b.growth_logs[0] if b.growth_logs else None
        tasks = []
        if latest_log and latest_log.actionable_tasks:
            try:
                tasks = json.loads(latest_log.actionable_tasks)
            except Exception:
                tasks = [latest_log.actionable_tasks]

        result.append({
            "id": b.id,
            "name": b.name,
            "crop": b.crop,
            "variety": b.variety,
            "acreage": b.acreage,
            "planting_date": b.planting_date,
            "status": b.status,
            "total_logs": len(b.growth_logs),
            "latest_stage": latest_log.growth_stage if latest_log else "Not evaluated yet",
            "latest_health_score": latest_log.health_score if latest_log else None,
            "latest_image_url": latest_log.image_url if latest_log else None,
            "immediate_tasks": tasks[:2],
        })

    return result


@router.get("/batch/{batch_id}")
def get_batch_timeline(batch_id: int, db: Session = Depends(get_db)):
    """Retrieve complete chronological growth progression timeline for a plot."""
    batch = db.query(CropBatch).filter(CropBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Crop plot not found.")

    logs = []
    for l in batch.growth_logs:
        tasks = []
        if l.actionable_tasks:
            try:
                tasks = json.loads(l.actionable_tasks)
            except Exception:
                tasks = [l.actionable_tasks]

        logs.append({
            "id": l.id,
            "image_url": l.image_url,
            "growth_stage": l.growth_stage,
            "health_score": l.health_score,
            "days_after_planting": l.days_after_planting,
            "canopy_coverage": l.canopy_coverage,
            "actionable_tasks": tasks,
            "gemma_analysis": l.gemma_analysis,
            "estimated_days_to_harvest": l.estimated_days_to_harvest,
            "created_at": l.created_at.strftime("%Y-%m-%d %H:%M"),
        })

    return {
        "id": batch.id,
        "name": batch.name,
        "crop": batch.crop,
        "variety": batch.variety,
        "acreage": batch.acreage,
        "planting_date": batch.planting_date,
        "status": batch.status,
        "timeline": logs,
    }


@router.post("/log")
def log_crop_growth(
    batch_id: int = Form(...),
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload a field photograph, evaluate growth phenology via Gemma, and record milestone."""
    batch = db.query(CropBatch).filter(CropBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Crop plot not found.")

    if not photo.filename:
        raise HTTPException(status_code=400, detail="Please select a crop photo.")

    content_type = photo.content_type or "image/jpeg"
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail="Upload JPEG, PNG, or WebP photo.")

    file_bytes = photo.file.read(MAX_IMAGE_BYTES + 1)
    if len(file_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Photo is too large (max 10MB).")

    # 1. Archive to Spaces / Local storage
    public_url, local_path = save_upload(
        file_bytes=file_bytes,
        original_filename=photo.filename,
        folder="growth",
        content_type=content_type,
    )

    # 2. Compute days after planting
    days_elapsed = 0
    try:
        planted = datetime.date.fromisoformat(batch.planting_date)
        days_elapsed = max(0, (datetime.date.today() - planted).days)
    except Exception:
        pass

    # 3. Analyze phenology with Gemma
    system_prompt = load_growth_prompt()
    user_query = f"Crop: {batch.crop} (Variety: {batch.variety or 'Standard'}). Planted on {batch.planting_date} ({days_elapsed} days ago). Please analyze growth stage and generate necessary field actions."

    try:
        data, answer = ask_gemma_json(
            prompt=user_query,
            media_path=local_path,
            system_prompt=system_prompt,
        )
    except GemmaUnavailable:
        raise HTTPException(status_code=503, detail="Gemma agronomist is currently busy. Please retry in a few moments.")
    except Exception as exc:
        log.exception("Crop phenology assessment failed: %s", exc)
        raise HTTPException(status_code=502, detail="Unable to assess growth photograph.")

    tasks = data.get("actionable_tasks", ["Inspect crop rows and monitor soil moisture."])
    growth_log = GrowthLog(
        batch_id=batch.id,
        image_url=public_url,
        growth_stage=data.get("growth_stage", "Vegetative"),
        health_score=int(data.get("health_score", 85) or 85),
        days_after_planting=days_elapsed,
        canopy_coverage=data.get("canopy_coverage", "Moderate"),
        actionable_tasks=json.dumps(tasks),
        gemma_analysis=data.get("phenology_summary", "Field showing steady vegetative progress."),
        estimated_days_to_harvest=int(data.get("estimated_days_to_harvest", 60) or 60),
    )
    db.add(growth_log)
    db.commit()
    db.refresh(growth_log)

    return {
        "status": "success",
        "log_id": growth_log.id,
        "image_url": public_url,
        "growth_stage": growth_log.growth_stage,
        "health_score": growth_log.health_score,
        "days_after_planting": growth_log.days_after_planting,
        "canopy_coverage": growth_log.canopy_coverage,
        "actionable_tasks": tasks,
        "gemma_analysis": growth_log.gemma_analysis,
        "estimated_days_to_harvest": growth_log.estimated_days_to_harvest,
        "created_at": growth_log.created_at.strftime("%Y-%m-%d %H:%M"),
        "model_used": answer.model,
    }
