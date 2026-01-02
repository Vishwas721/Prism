from typing import Any, Dict, List

from pydantic import BaseModel, Field


class AnalysisResult(BaseModel):
    status: str
    reasoning: str
    summary: str = ""  # One-sentence summary for UI
    entities_detected: List[str] = Field(default_factory=list)
    fhir_json: Dict[str, Any] = Field(default_factory=dict)
    rfi_draft: str = ""
    evidence_quote: str = ""
    # Dynamic checklist fields
    criteria_met: bool = False
    missing_criteria: str = ""
    documentation_complete: bool = True
    missing_documentation: str = ""
    policy_match: bool = False
