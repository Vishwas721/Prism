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
    summary: str = Field(default="")  # One-sentence summary for UI display
    rfi_draft: str = Field(default="")
    evidence_quote: str = Field(default="")
    # Dynamic checklist fields
    criteria_met: bool = Field(default=False)
    missing_criteria: str = Field(default="")
    documentation_complete: bool = Field(default=True)
    missing_documentation: str = Field(default="")
    policy_match: bool = Field(default=False)

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
        "You are a Medical Auditor AI. Compare the Patient Note against the Policy criteria. "
        "Analyze thoroughly and respond with a structured JSON decision.\n\n"
        "RULES:\n"
        "- If all criteria are met with complete documentation: status='APPROVED'\n"
        "- If patient fails to meet medical criteria: status='DENIED'\n"
        "- If criteria seem met but documentation is missing (e.g., X-rays, specific dates, lab results): status='ACTION_REQUIRED'\n\n"
        "REQUIRED JSON FIELDS:\n"
        "{\n"
        '  "status": "APPROVED" | "DENIED" | "ACTION_REQUIRED",\n'
        '  "summary": "One clear sentence explaining the decision (e.g., \'Patient meets criteria for knee replacement pending X-ray documentation.\')",\n'
        '  "reason": "Detailed explanation of the decision",\n'
        '  "criteria_met": true/false (whether clinical criteria from policy are satisfied),\n'
        '  "missing_criteria": "If criteria_met=false, explain which specific criteria failed",\n'
        '  "documentation_complete": true/false (whether all required docs are present),\n'
        '  "missing_documentation": "If documentation_complete=false, list missing docs",\n'
        '  "policy_match": true/false (whether treatment aligns with policy guidelines),\n'
        '  "evidence_quote": "EXACT quote from patient note supporting your finding",\n'
        '  "rfi_draft": "If ACTION_REQUIRED, draft email requesting missing info"\n'
        "}\n\n"
        "Respond with valid JSON only, no markdown."
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
        summary="Unable to process document",
        rfi_draft="",
        evidence_quote="",
        criteria_met=False,
        missing_criteria="",
        documentation_complete=True,
        missing_documentation="",
        policy_match=False,
    )
