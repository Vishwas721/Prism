import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

PATIENTS_FILE = Path(__file__).parent.parent / "data" / "patients.json"
PROVIDERS_FILE = Path(__file__).parent.parent / "data" / "providers.json"


def get_all_patients() -> List[Dict]:
    """Read and return all patient cases from the JSON data store."""
    if not PATIENTS_FILE.exists():
        return []
    
    with open(PATIENTS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def get_patient_by_id(patient_id: str) -> Optional[Dict]:
    """Get a specific patient case by ID."""
    patients = get_all_patients()
    for patient in patients:
        if patient.get("id") == patient_id:
            return patient
    return None


def get_provider_by_id(provider_id: str) -> Optional[Dict]:
    """Get a specific provider by ID."""
    if not PROVIDERS_FILE.exists():
        return None
    
    with open(PROVIDERS_FILE, "r", encoding="utf-8") as f:
        providers = json.load(f)
    
    for provider in providers:
        if provider.get("id") == provider_id:
            return provider
    return None


def get_all_providers() -> List[Dict]:
    """Get all providers from the database."""
    if not PROVIDERS_FILE.exists():
        return []
    
    with open(PROVIDERS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def create_patient_case(
    patient_name: str,
    policy_id: str,
    policy_name: str,
    file_path: str,
    provider_id: str = None,
    sla_hours: int = 72,
) -> Dict:
    """Create a new patient case entry."""
    patients = get_all_patients()
    
    # Generate a unique incremental case ID based on the highest existing numeric suffix
    existing_ids = {patient.get("id") for patient in patients if patient.get("id")}
    existing_numbers = []
    for pid in existing_ids:
        try:
            # Expect format case-XXX; ignore malformed IDs instead of crashing
            existing_numbers.append(int(str(pid).split("-")[-1]))
        except (ValueError, TypeError):
            continue
    next_number = (max(existing_numbers) if existing_numbers else 0) + 1
    case_id = f"case-{next_number:03d}"

    # Guard against accidental collision (e.g., simultaneous writes)
    while case_id in existing_ids:
        next_number += 1
        case_id = f"case-{next_number:03d}"
    
    # Load provider info if provided
    provider = None
    provider_name = None
    if provider_id:
        provider = get_provider_by_id(provider_id)
        if provider:
            provider_name = provider.get("name")
    
    # Check if provider has GOLD_CARD status for auto-approval
    is_gold_card = provider and provider.get("status") == "GOLD_CARD"
    
    # Create analysis result for GOLD_CARD providers
    analysis_result = None
    status = "PENDING"
    
    if is_gold_card:
        # Auto-approve for GOLD_CARD providers
        analysis_result = {
            "status": "AUTO_APPROVED",
            "reasoning": f"Provider holds active Gold Card ({provider.get('approval_rate', 98)}% Approval Rate). AI Review bypassed under State Law exemption: {provider.get('exemption', 'N/A')}.",
            "summary": "Gold Card Provider - Automatic Approval",
            "evidence_quote": "N/A - Regulatory Auto-Approval",
            "criteria_met": True,
            "documentation_complete": True,
            "policy_match": True,
            "entities_detected": [],
            "fhir_json": {}
        }
        status = "AUTO_APPROVED"
    
    new_case = {
        "id": case_id,
        "patient_name": patient_name,
        "policy_id": policy_id,
        "policy_name": policy_name,
        "provider_id": provider_id,
        "provider_name": provider_name,
        "status": status,
        "received_date": datetime.now(timezone.utc).isoformat(),
        "sla_hours": sla_hours,
        "sla_remaining_hours": sla_hours,
        "file_path": file_path,
        "analysis_result": analysis_result,
        "rfi_sent": False,
        "rfi_sent_at": None,
    }
    
    patients.append(new_case)
    _save_patients(patients)
    
    return new_case


def update_patient_analysis(patient_id: str, analysis_result: Dict) -> Dict:
    """Update patient case with analysis results."""
    patients = get_all_patients()
    
    for patient in patients:
        if patient.get("id") == patient_id:
            patient["analysis_result"] = analysis_result
            patient["status"] = analysis_result.get("status", "UNKNOWN")
            _save_patients(patients)
            return patient
    
    raise ValueError(f"Patient case '{patient_id}' not found")


def mark_rfi_sent(patient_id: str, message: str = "") -> Dict:
    """Mark that an RFI has been sent for this patient case."""
    patients = get_all_patients()
    
    for patient in patients:
        if patient.get("id") == patient_id:
            patient["rfi_sent"] = True
            patient["rfi_sent_at"] = datetime.now(timezone.utc).isoformat()
            patient["rfi_message"] = message
            _save_patients(patients)
            return patient
    
    raise ValueError(f"Patient case '{patient_id}' not found")


def _save_patients(patients: List[Dict]) -> None:
    """Save patients list to JSON file."""
    with open(PATIENTS_FILE, "w", encoding="utf-8") as f:
        json.dump(patients, f, indent=2, ensure_ascii=False)
