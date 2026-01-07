import logging
import shutil
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from services import patient_service, policy_service

router = APIRouter(prefix="/api", tags=["patients"])
logger = logging.getLogger("prism.patients")

UPLOAD_DIR = Path(__file__).parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


@router.get("/patients")
async def list_patients():
    """Get all patient cases."""
    try:
        patients = patient_service.get_all_patients()
        return patients
    except Exception as exc:
        logger.exception("Failed to list patients")
        raise HTTPException(status_code=500, detail="Failed to retrieve patients") from exc


@router.get("/patients/{patient_id}")
async def get_patient(patient_id: str):
    """Get a specific patient case by ID."""
    try:
        patient = patient_service.get_patient_by_id(patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail=f"Patient case '{patient_id}' not found")
        return patient
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"Failed to retrieve patient {patient_id}")
        raise HTTPException(status_code=500, detail="Failed to retrieve patient") from exc


@router.post("/patients/{patient_id}/send-rfi")
async def send_rfi(patient_id: str, message: str = Form("")):
    """Mark that an RFI has been sent for this patient case."""
    try:
        patient = patient_service.get_patient_by_id(patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail=f"Patient case '{patient_id}' not found")
        
        updated = patient_service.mark_rfi_sent(patient_id, message)
        logger.info(f"RFI sent for case {patient_id}")
        return {"success": True, "patient": updated}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"Failed to send RFI for patient {patient_id}")
        raise HTTPException(status_code=500, detail="Failed to send RFI") from exc


@router.post("/upload")
async def upload_case(
    file: UploadFile = File(...),
    patient_name: str = Form(...),
    policy_id: str = Form(...),
    provider_id: str = Form(None),
    sla_hours: int = Form(72),
):
    """Upload a new patient case file."""
    try:
        # Validate policy exists
        policy = policy_service.get_policy_by_id(policy_id)
        if not policy:
            raise HTTPException(status_code=400, detail=f"Policy '{policy_id}' not found")
        
        # Force cursor reset and read content explicitly
        await file.seek(0)
        content = await file.read()
        
        # Debug logging
        print(f"DEBUG UPLOAD: Read {len(content)} bytes from {file.filename}")
        logger.info(f"DEBUG UPLOAD: Read {len(content)} bytes from {file.filename}")
        
        # Safety check: ensure file is not empty
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="File is empty!")
        
        # Save file to uploads directory
        file_path = UPLOAD_DIR / f"{patient_name.replace(' ', '_').lower()}_{file.filename}"
        with file_path.open("wb") as buffer:
            buffer.write(content)
        
        # Create patient case entry (with optional provider_id for fast lane)
        case = patient_service.create_patient_case(
            patient_name=patient_name,
            policy_id=policy_id,
            policy_name=policy.get("name", ""),
            file_path=str(file_path.relative_to(Path(__file__).parent.parent)),
            provider_id=provider_id,
            sla_hours=sla_hours,
        )
        
        logger.info(f"Created new case {case['id']} for {patient_name}")
        return case
    
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to upload case")
        raise HTTPException(status_code=500, detail="Failed to upload case") from exc
