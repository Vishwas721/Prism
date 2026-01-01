import asyncio
import json
import os
from typing import List, Literal, Optional

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel, Field, validator

load_dotenv()

_openai_client: Optional[OpenAI] = None
MODEL_NAME = "gpt-4o"


class PolicyDecision(BaseModel):
    status: Literal["APPROVED", "DENIED", "ACTION_REQUIRED", "UNKNOWN"]
    reason: str = Field(..., min_length=1)
    rfi_draft: str = Field(default="")
    evidence_quote: str = Field(default="")

    @validator("status", pre=True)
    def normalize_status(cls, value: str) -> str:  # noqa: D401
        """Normalize status strings to the allowed set."""
        if not isinstance(value, str):
            return "UNKNOWN"
        value_upper = value.strip().upper()
        if value_upper in {"APPROVED", "DENIED", "ACTION_REQUIRED"}:
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


async def evaluate_medical_policy(
    policy_text: str,
    patient_note: str,
    entities: Optional[List[str]] = None,
) -> PolicyDecision:
    """Compare patient note against policy and return a validated decision."""
    if not policy_text or not patient_note:
        raise ValueError("Both policy_text and patient_note are required.")

    client = _get_openai_client()

    system_prompt = (
        "You are a Medical Auditor. Compare the Patient Note against the Policy. "
        "If the patient meets some criteria but is missing specific required documentation (like X-rays or specific dates), return status: 'ACTION_REQUIRED'. "
        "In the 'reasoning' field, explain what is missing. Add a new JSON field 'rfi_draft': 'Draft a polite, professional email to Dr. [Provider Name] requesting the specific missing document to satisfy Policy [Policy Name].'. "
        "For every decision, you MUST extract the exact direct quote from the patient note that supports your finding. Return this in a new JSON field called 'evidence_quote'. "
        "Respond with valid JSON only: {status: 'APPROVED'|'DENIED'|'ACTION_REQUIRED', reason: '...', rfi_draft: '...', evidence_quote: '...'}"
    )
    entities_section = f"\n\nDetected Entities:\n{entities}" if entities else ""
    user_prompt = (
        f"Policy:\n{policy_text}\n\nPatient Note:\n{patient_note}{entities_section}\n"
    )

    response = await asyncio.to_thread(
        client.chat.completions.create,
        model=MODEL_NAME,
        temperature=0.2,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )

    content = response.choices[0].message.content.strip() if response.choices else ""

    # CLEANING LOGIC START: strip markdown code fences often returned by models
    if content.startswith("```json"):
        content = content[7:]
    if content.startswith("```"):
        content = content[3:]
    if content.endswith("```"):
        content = content[:-3]
    content = content.strip()
    # CLEANING LOGIC END

    try:
        parsed = json.loads(content)
        return PolicyDecision.parse_obj(parsed)
    except (json.JSONDecodeError, ValueError):
        pass

    return PolicyDecision(
        status="UNKNOWN",
        reason=(content or "Empty model response").strip(),
        rfi_draft="",
        evidence_quote="",
    )
