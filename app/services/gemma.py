import json
import logging
import os
import random
import re
import time
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Callable, Dict, Optional, Tuple

from app.config import settings

log = logging.getLogger(__name__)

TRANSIENT_CODES = frozenset({429, 500, 502, 503, 504})
TRANSIENT_ERROR_NAMES = frozenset(
    {
        "TimeoutError",
        "ReadTimeout",
        "ConnectTimeout",
        "TimeoutException",
        "ConnectError",
        "RemoteProtocolError",
    }
)


class ConfigError(RuntimeError):
    """Server is missing essential configuration (e.g. GEMINI_API_KEY)."""


class GemmaUnavailable(RuntimeError):
    """Every configured Gemma model failed after maximum retries."""

    def __init__(self, message: str, last_error: Optional[BaseException] = None):
        super().__init__(message)
        self.last_error = last_error


class _EmptyResponse(Exception):
    """The API returned a 200 OK status but generated no text."""


@dataclass(frozen=True)
class Answer:
    text: str
    model: str
    attempts: int


@lru_cache(maxsize=1)
def get_client(timeout_s: float = 35.0) -> Any:
    """Instantiate Google GenAI Client with explicit timeouts."""
    from google import genai
    from google.genai import types

    api_key = settings.gemini_api_key
    if not api_key:
        raise ConfigError(
            "GEMINI_API_KEY is not set. Please provide a valid Gemini API key in .env"
        )
    return genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(timeout=int(timeout_s * 1000)),
    )


def _error_code(exc: BaseException) -> Optional[int]:
    code = getattr(exc, "code", None)
    return code if isinstance(code, int) else None


def _is_transient(exc: BaseException) -> bool:
    if isinstance(exc, _EmptyResponse):
        return True
    if _error_code(exc) in TRANSIENT_CODES:
        return True
    return type(exc).__name__ in TRANSIENT_ERROR_NAMES


def ask_gemma(
    prompt: str,
    media_path: Optional[os.PathLike] = None,
    *,
    system_prompt: Optional[str] = None,
    client: Any = None,
    sleep: Callable[[float], None] = time.sleep,
) -> Answer:
    """Execute a prompt against Google Gemma with automatic retries, backoff, and fallback."""
    client = client or get_client(settings.gemma_timeout)

    config = None
    if system_prompt:
        from google.genai import types
        config = types.GenerateContentConfig(system_instruction=system_prompt)

    uploaded = None
    attempts = 0
    last_error: Optional[BaseException] = None

    for model in settings.gemma_models:
        for attempt in range(1, settings.gemma_retries + 1):
            attempts += 1
            try:
                if media_path is not None and uploaded is None:
                    # Upload media file (photo or audio) to the Google GenAI Files API
                    uploaded = client.files.upload(file=str(media_path))

                contents = [uploaded, prompt] if uploaded is not None else [prompt]
                response = client.models.generate_content(
                    model=model, contents=contents, config=config
                )
                text = (response.text or "").strip()
                if not text:
                    raise _EmptyResponse()
                return Answer(text=text, model=model, attempts=attempts)
            except Exception as exc:
                last_error = exc
                if _error_code(exc) == 404:
                    log.warning("%s not found for this key, switching to next model", model)
                    break
                if not _is_transient(exc):
                    raise
                log.warning(
                    "%s attempt %d/%d failed: %s",
                    model, attempt, settings.gemma_retries, exc
                )
                if attempt < settings.gemma_retries:
                    delay = settings.gemma_base_delay * (2 ** (attempt - 1))
                    sleep(delay + random.uniform(0, settings.gemma_base_delay / 2))

    raise GemmaUnavailable(
        f"All Gemma models failed after {attempts} attempts ({', '.join(settings.gemma_models)})",
        last_error=last_error,
    )


def extract_json(text: str) -> Dict[str, Any]:
    """Safely parse JSON from raw text or markdown code blocks."""
    text = text.strip()
    # Strip markdown fenced code blocks if present
    code_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if code_match:
        text = code_match.group(1).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Heuristic: find outer { ... }
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                pass
    return {}


def ask_gemma_json(
    prompt: str,
    media_path: Optional[os.PathLike] = None,
    *,
    system_prompt: Optional[str] = None,
    client: Any = None,
    sleep: Callable[[float], None] = time.sleep,
) -> Tuple[Dict[str, Any], Answer]:
    """Call Gemma and parse output directly as a structured dictionary."""
    answer = ask_gemma(
        prompt,
        media_path=media_path,
        system_prompt=system_prompt,
        client=client,
        sleep=sleep,
    )
    data = extract_json(answer.text)
    return data, answer

