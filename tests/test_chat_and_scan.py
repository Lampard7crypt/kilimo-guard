import io
from unittest.mock import patch
from app.services.gemma import Answer


def test_chat_message_sale_detection(client):
    mock_data = {
        "is_sale": True,
        "commodity": "Maize (Dry)",
        "category": "Crop Sale",
        "quantity": 20.0,
        "unit": "90kg bag",
        "unit_price": 3600.0,
        "total_amount": 72000.0,
        "counterparty": "Wakulima Broker",
        "reply_text": "Hongera mkulima! Nimepata mauzo yako ya gunia 20 za mahindi.",
    }
    mock_answer = Answer(text="raw response", model="gemma-4-26b-a4b-it", attempts=1)

    with patch("app.routes.chat.ask_gemma_json", return_value=(mock_data, mock_answer)):
        res = client.post(
            "/api/chat/message",
            data={"message": "Nimeuza gunia 20 za mahindi kwa 3600 kila moja"},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["is_sale"] is True
        assert "Hongera mkulima" in body["reply_text"]
        assert body["draft_sale"]["commodity"] == "Maize (Dry)"
        assert body["draft_sale"]["total_amount"] == 72000.0
        assert body["market_evaluation"] is not None


def test_disease_scan_upload(client):
    mock_data = {
        "crop": "Tomato",
        "diagnosis": "Tomato Late Blight",
        "confidence": "High",
        "symptoms": "Water-soaked dark lesions on leaf surfaces",
        "organic_treatment": "Remove and incinerate blighted foliage; spray copper fungicide.",
        "chemical_treatment": "Mancozeb 80% WP or Ridomil Gold MZ 68 WG.",
        "prevention": "Ensure good plant spacing and avoid overhead irrigation.",
    }
    mock_answer = Answer(text="raw diagnosis", model="gemma-4-26b-a4b-it", attempts=1)

    fake_image_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb"

    with patch("app.routes.scan.ask_gemma_json", return_value=(mock_data, mock_answer)):
        res = client.post(
            "/api/scan/disease",
            files={"image": ("leaf.jpg", io.BytesIO(fake_image_bytes), "image/jpeg")},
            data={"crop_hint": "Tomatoes"},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["crop"] == "Tomato"
        assert body["diagnosis"] == "Tomato Late Blight"
        assert "Ridomil" in body["chemical_treatment"]


def test_receipt_scan_upload(client):
    mock_data = {
        "vendor": "Kenya Seed Agrovet Nakuru",
        "category": "Seeds",
        "commodity": "DK 777 Hybrid Maize Seed (2kg)",
        "quantity": 3.0,
        "unit": "packets",
        "unit_price": 600.0,
        "total_amount": 1800.0,
        "summary": "Purchased 3 packets of DK 777 Hybrid Maize seed.",
    }
    mock_answer = Answer(text="raw receipt", model="gemma-4-26b-a4b-it", attempts=1)

    fake_receipt_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb"

    with patch("app.routes.ledger.ask_gemma_json", return_value=(mock_data, mock_answer)):
        res = client.post(
            "/api/ledger/receipt/scan",
            files={"receipt": ("receipt.jpg", io.BytesIO(fake_receipt_bytes), "image/jpeg")},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["counterparty"] == "Kenya Seed Agrovet Nakuru"
        assert body["total_amount"] == 1800.0
        assert body["commodity"] == "DK 777 Hybrid Maize Seed (2kg)"
