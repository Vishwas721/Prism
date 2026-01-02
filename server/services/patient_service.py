import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

PATIENTS_FILE = Path(__file__).parent.parent / "data" / "patients.json"


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


def create_patient_case(
    patient_name: str,
    policy_id: str,
    policy_name: str,
    file_path: str,
    sla_hours: int = 72,
) -> Dict:
    """Create a new patient case entry."""
    patients = get_all_patients()
    
    # Generate new ID
    case_number = len(patients) + 1
    case_id = f"case-{case_number:03d}"
    
    new_case = {
        "id": case_id,
        "patient_name": patient_name,
        "policy_id": policy_id,
        "policy_name": policy_name,
        "status": "PENDING",
        "received_date": datetime.now(timezone.utc).isoformat(),
        "sla_hours": sla_hours,
        "sla_remaining_hours": sla_hours,
        "file_path": file_path,
        "analysis_result": None,
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
