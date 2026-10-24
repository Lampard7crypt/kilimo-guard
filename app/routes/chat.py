import logging
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Farmer
from app.services.gemma import GemmaUnavailable, ask_gemma_json
from app.services.market import evaluate_sale_price
from app.services.storage import save_upload

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat", tags=["Voice & Conversational Sales Chat"])

ALLOWED_AUDIO_TYPES = {
    "audio/webm",
    "audio/wav",
    "audio/wave",
    "audio/x-wav",
    "audio/mp3",
    "audio/mpeg",
    "audio/ogg",
    "audio/m4a",
    "audio/mp4",
}
CHAT_PROMPT_PATH = Path(__file__).resolve().parent.parent.parent / "prompts" / "ledger_chat.txt"


def load_chat_prompt() -> str:
    return CHAT_PROMPT_PATH.read_text(encoding="utf-8").strip()


@router.post("/message")
def handle_chat_message(
    message: Optional[str] = Form(None),
    audio: Optional[UploadFile] = File(None),
    farmer_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
):
    """Process text or voice messages from the farmer, extract sales transactions, and cross-reference Kenya market prices."""
    has_text = bool(message and message.strip())
    has_audio = audio is not None and bool(audio.filename)

    if not has_text and not has_audio:
        raise HTTPException(
            status_code=400,
            detail="Please provide a text message or a voice note.",
        )

    system_prompt = load_chat_prompt()
    media_path = None
    audio_url = None

    if has_audio:
        content_type = audio.content_type or "audio/webm"
        file_bytes = audio.file.read()
        if len(file_bytes) > 15 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Voice note is too large (max 15MB).")

        # Save audio note to DO Spaces (or local fallback)
        audio_url, media_path = save_upload(
            file_bytes=file_bytes,
            original_filename=audio.filename,
            folder="voice",
            content_type=content_type,
        )

    prompt = (
        message.strip()
        if has_text
        else "Listen carefully to this farmer's voice note. Understand their language (English, Kiswahili, or Sheng) and extract any sales transaction or answer their agricultural inquiry."
    )

    try:
        data, answer = ask_gemma_json(
            prompt=prompt,
            media_path=media_path,
            system_prompt=system_prompt,
        )
    except GemmaUnavailable:
        raise HTTPException(
            status_code=503,
            detail="Gemma assistant is currently busy. Please try again shortly.",
        )
    except Exception as exc:
        log.exception("Chat processing failed: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="Unable to process your message at this time. Please try again.",
        )

    is_sale = bool(data.get("is_sale", False))
    reply_text = data.get("reply_text", "Asante! Nimepokea ujumbe wako.")

    draft_sale = None
    market_evaluation = None

    if is_sale:
        commodity = data.get("commodity", "Crop Sale")
        quantity = float(data.get("quantity", 1.0) or 1.0)
        unit_price = float(data.get("unit_price", 0.0) or 0.0)
        total_amount = float(data.get("total_amount", 0.0) or (quantity * unit_price))
        unit = data.get("unit", "units")
        counterparty = data.get("counterparty", "Market Buyer")

        # Retrieve farmer county for market price comparison
        farmer_county = None
        if farmer_id:
            farmer = db.query(Farmer).filter(Farmer.id == farmer_id).first()
            if farmer:
                farmer_county = farmer.county

        # Compare with Kenyan agricultural market benchmark
        market_evaluation = evaluate_sale_price(
            commodity=commodity,
            unit_price=unit_price,
            unit=unit,
            db=db,
            farmer_county=farmer_county,
        )

        draft_sale = {
            "farmer_id": farmer_id,
            "transaction_type": "income",
            "category": "Crop Sale",
            "commodity": commodity,
            "quantity": quantity,
            "unit": unit,
            "unit_price": unit_price,
            "total_amount": total_amount,
            "counterparty": counterparty,
            "notes": f"Recorded via chat voice/text input. {market_evaluation.get('message', '')}",
        }

    return {
        "reply_text": reply_text,
        "is_sale": is_sale,
        "draft_sale": draft_sale,
        "market_evaluation": market_evaluation,
        "audio_url": audio_url,
        "model_used": answer.model,
    }
