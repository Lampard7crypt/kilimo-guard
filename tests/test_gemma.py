from unittest.mock import MagicMock
import pytest
from app.services.gemma import (
    Answer,
    GemmaUnavailable,
    ask_gemma,
    ask_gemma_json,
    extract_json,
)


class FakeResponse:
    def __init__(self, text: str):
        self.text = text


class FakeError(Exception):
    def __init__(self, code: int, message: str = "error"):
        super().__init__(message)
        self.code = code


def test_extract_json_plain():
    raw = '{"crop": "Maize", "diagnosis": "Maize Lethal Necrosis"}'
    parsed = extract_json(raw)
    assert parsed.get("crop") == "Maize"
    assert parsed.get("diagnosis") == "Maize Lethal Necrosis"


def test_extract_json_markdown_fence():
    raw = """Here is the result:
```json
{
  "commodity": "Irish Potatoes",
  "quantity": 5.0,
  "unit_price": 2500
}
```
Hope this helps!"""
    parsed = extract_json(raw)
    assert parsed.get("commodity") == "Irish Potatoes"
    assert parsed.get("quantity") == 5.0


def test_ask_gemma_success():
    client = MagicMock()
    client.models.generate_content.return_value = FakeResponse("Habari mkulima!")

    ans = ask_gemma("Jambo", client=client, sleep=lambda s: None)
    assert ans.text == "Habari mkulima!"
    assert ans.model == "gemma-4-26b-a4b-it"
    assert ans.attempts == 1


def test_ask_gemma_retry_on_transient():
    client = MagicMock()
    # First attempt fails with 500, second succeeds
    client.models.generate_content.side_effect = [
        FakeError(500, "Internal Server Error"),
        FakeResponse("Successful response after retry"),
    ]

    ans = ask_gemma("Retry prompt", client=client, sleep=lambda s: None)
    assert ans.text == "Successful response after retry"
    assert ans.attempts == 2


def test_ask_gemma_model_fallback():
    client = MagicMock()
    # First model raises 404 (model not found), second model succeeds
    client.models.generate_content.side_effect = [
        FakeError(404, "Model not supported"),
        FakeResponse("Response from fallback model"),
    ]

    ans = ask_gemma("Fallback test", client=client, sleep=lambda s: None)
    assert ans.text == "Response from fallback model"
    assert ans.model == "gemma-4-31b-it"


def test_ask_gemma_json():
    client = MagicMock()
    client.models.generate_content.return_value = FakeResponse(
        '{"crop": "Tomato", "diagnosis": "Early Blight", "confidence": "High"}'
    )

    data, ans = ask_gemma_json("Diagnose", client=client)
    assert data["crop"] == "Tomato"
    assert data["diagnosis"] == "Early Blight"
    assert data["confidence"] == "High"
