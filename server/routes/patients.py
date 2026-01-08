import logging
import re
import shutil
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from services import ocr_service, patient_service, policy_service

router = APIRouter(prefix="/api", tags=["patients"])
logger = logging.getLogger("prism.patients")

UPLOAD_DIR = Path(__file__).parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


def _guess_patient_name_from_text(text: str) -> Optional[str]:
    """Heuristically pull a patient name from OCR'd text and strip labels.

    Handles patterns like:
    - "Patient Name: Jane Doe"
    - "Name - John Smith"
    - "Name: Tharun" → "Tharun"
    - Single-word names
    """
    if not text:
        return None

    def _clean_candidate(s: str) -> str:
        s = s.strip()
        # Strip common label prefixes with optional punctuation
        s = re.sub(r"^(patient\s*name|member\s*name|patient|name)\s*[:\-–—]*\s*",
                   "", s, flags=re.IGNORECASE)
        s = s.strip(" -:|\t")
        # Remove non-name characters (keep letters, spaces, apostrophes, hyphens, dots)
        s = re.sub(r"[^A-Za-z\s\.'-]", "", s).strip()
        # Trim to at most 4 words
        parts = [p for p in s.split() if p]
        if parts and parts[0].lower() in {"name", "patient", "member"}:
            parts = parts[1:]
        parts = parts[:4]
        return " ".join(parts)

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    candidates = []

    # Look for common prefixes
    prefixes = ["patient name", "member name", "name", "patient"]
    for line in lines[:120]:  # limit scan for performance
        lower_line = line.lower()
        if any(prefix in lower_line for prefix in prefixes):
            # Split on common separators if present, else take full line
            parts = re.split(r"[:\-–—]", line, maxsplit=1)
            candidate = parts[1] if len(parts) > 1 else line
            cleaned = _clean_candidate(candidate)
            if 1 <= len(cleaned.split()) <= 4:
                candidates.append(cleaned)

    # Fallback: first reasonably short line that looks like a name (1-4 words)
    if not candidates:
        for line in lines[:80]:
            cleaned = _clean_candidate(line)
            if 1 <= len(cleaned.split()) <= 4 and cleaned:
                candidates.append(cleaned)

    if candidates:
        # Prefer shortest plausible candidate to avoid long sentences
        best = sorted(candidates, key=len)[0]
        return best.title()
    return None


def _slugify_name_for_file(name: str) -> str:
    safe = re.sub(r"[^a-zA-Z0-9]+", "_", name.strip().lower())
    safe = re.sub(r"_+", "_", safe).strip("_")
    return safe or "patient"


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
    patient_name: Optional[str] = Form(None),
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
        
        # Extract patient name from document if not provided
        resolved_patient_name = (patient_name or "").strip()
        if not resolved_patient_name:
            try:
                ocr_text = await ocr_service.extract_text_from_pdf(content)
                resolved_patient_name = _guess_patient_name_from_text(ocr_text) or ""
            except Exception as exc:  # noqa: BLE001
                logger.warning(f"Failed to auto-extract patient name: {exc}")

        # Final fallback: derive from file name or default
        if not resolved_patient_name:
            stem = Path(file.filename).stem.replace("_", " ").strip()
            resolved_patient_name = stem.title() if stem else "Unknown Patient"

        # Save file to uploads directory with safe prefix
        file_prefix = _slugify_name_for_file(resolved_patient_name)
        file_path = UPLOAD_DIR / f"{file_prefix}_{file.filename}"
        with file_path.open("wb") as buffer:
            buffer.write(content)

        # Create patient case entry (with optional provider_id for fast lane)
        case = patient_service.create_patient_case(
            patient_name=resolved_patient_name,
            policy_id=policy_id,
            policy_name=policy.get("name", ""),
            file_path=str(file_path.relative_to(Path(__file__).parent.parent)),
            provider_id=provider_id,
            sla_hours=sla_hours,
        )
        
        logger.info(f"Created new case {case['id']} for {resolved_patient_name}")
        return case
    
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to upload case")
        raise HTTPException(status_code=500, detail="Failed to upload case") from exc
