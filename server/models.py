from typing import Any, Dict, List

from pydantic import BaseModel, Field


class AnalysisResult(BaseModel):
    status: str
    reasoning: str
    entities_detected: List[str] = Field(default_factory=list)
    fhir_json: Dict[str, Any] = Field(default_factory=dict)
    rfi_draft: str = ""
