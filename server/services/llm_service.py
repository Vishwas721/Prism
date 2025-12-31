import asyncio
import json
import os
from typing import Literal, Optional

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel, Field, validator

load_dotenv()

_openai_client: Optional[OpenAI] = None
MODEL_NAME = "gpt-4o"


class PolicyDecision(BaseModel):
    status: Literal["APPROVED", "DENIED", "UNKNOWN"]
    reason: str = Field(..., min_length=1)

    @validator("status", pre=True)
    def normalize_status(cls, value: str) -> str:  # noqa: D401
        """Normalize status strings to the allowed set."""
        if not isinstance(value, str):
            return "UNKNOWN"
        value_upper = value.strip().upper()
        if value_upper in {"APPROVED", "DENIED"}:
            return value_upper
        return "UNKNOWN"


def _get_openai_client() -> OpenAI:
    global _openai_client
    if _openai_client:
        return _openai_client

    token = os.getenv("GITHUB_TOKEN")
    if not token:
        raise RuntimeError("GITHUB_TOKEN is not set; cannot initialize GitHub Models client.")

    _openai_client = OpenAI(
        base_url="https://models.inference.ai.azure.com",
        api_key=token,
    )
    return _openai_client


async def evaluate_medical_policy(policy_text: str, patient_note: str) -> PolicyDecision:
    """Compare patient note against policy and return a validated decision."""
    if not policy_text or not patient_note:
        raise ValueError("Both policy_text and patient_note are required.")

    client = _get_openai_client()

    system_prompt = (
        "You are a Medical Auditor. Compare the Patient Note against the Policy. "
        "Respond with valid JSON only: {status: 'APPROVED'|'DENIED', reason: '...'}"
    )
    user_prompt = f"Policy:\n{policy_text}\n\nPatient Note:\n{patient_note}\n"

    response = await asyncio.to_thread(
        client.chat.completions.create,
        model=MODEL_NAME,
        temperature=0.2,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )

    content = response.choices[0].message.content if response.choices else ""

    try:
        parsed = json.loads(content)
        return PolicyDecision.parse_obj(parsed)
    except (json.JSONDecodeError, ValueError):
        pass

    return PolicyDecision(status="UNKNOWN", reason=(content or "Empty model response").strip())
