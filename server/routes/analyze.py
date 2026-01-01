import logging
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from models import AnalysisResult
from services import entity_service, llm_service, ocr_service, policy_service, patient_service

router = APIRouter(prefix="/api", tags=["analyze"])
logger = logging.getLogger("prism.analyze")


@router.post("/analyze", response_model=AnalysisResult)
async def analyze_document(
    file: UploadFile = File(None),
    policy_id: str = Form(...),
    patient_id: str = Form(None),
):
    # Step 0: Fetch policy text
    try:
        policy_text = policy_service.get_policy_text(policy_id)
    except ValueError as exc:
        logger.exception("Invalid policy ID")
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Step 1: Read file (either from upload or disk)
    file_bytes = None
    
    if file:
        # File uploaded directly (QuickAnalysis flow)
        try:
            await file.seek(0)
            file_bytes = await file.read()
            print(f"DEBUG ANALYZE (Upload): Read {len(file_bytes)} bytes from {file.filename}")
            logger.info(f"DEBUG ANALYZE (Upload): Read {len(file_bytes)} bytes from {file.filename}")
        except Exception as exc:
            logger.exception("Failed to read uploaded file")
            raise HTTPException(status_code=400, detail="Failed to read document") from exc
    elif patient_id:
        # Read from disk (Dashboard flow)
        try:
            patient = patient_service.get_patient_by_id(patient_id)
            if not patient:
                raise HTTPException(status_code=404, detail=f"Patient case '{patient_id}' not found")
            
            file_path = Path(__file__).parent.parent / patient.get("file_path", "")
            
            if not file_path.exists():
                raise HTTPException(status_code=404, detail="Patient file not found on server")
            
            with file_path.open("rb") as f:
                file_bytes = f.read()
            
            print(f"DEBUG ANALYZE (Disk): Read {len(file_bytes)} bytes from {file_path.name}")
            logger.info(f"DEBUG ANALYZE (Disk): Read {len(file_bytes)} bytes from {file_path.name}")
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to read file from disk")
            raise HTTPException(status_code=400, detail="Failed to read patient file") from exc
    else:
        raise HTTPException(status_code=400, detail="Either file or patient_id must be provided")
    
    # Safety check: ensure file is not empty
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Saved file is empty on disk!")

    logger.info("Extracting...")
    try:
        ocr_text = await ocr_service.extract_text_from_pdf(file_bytes)
    except Exception as exc:
        logger.exception("OCR extraction failed")
        raise HTTPException(status_code=400, detail="Failed to read document") from exc

    logger.info("Found Entities...")
    entities_result = await entity_service.extract_medical_entities(ocr_text)
    entities = entities_result.get("entities", []) if isinstance(entities_result, dict) else []

    logger.info("Decision Made...")
    decision = await llm_service.evaluate_medical_policy(policy_text, ocr_text, entities)

    result = AnalysisResult(
        status=decision.status,
        reasoning=decision.reason,
        entities_detected=entities,
        fhir_json={"entities": entities},
        rfi_draft=decision.rfi_draft,
        evidence_quote=decision.evidence_quote,
    )

    # Update patient case if patient_id provided
    if patient_id:
        try:
            patient_service.update_patient_analysis(patient_id, result.dict())
            logger.info(f"Updated patient case {patient_id} with analysis results")
        except ValueError as exc:
            logger.warning(f"Failed to update patient case: {exc}")

    return result
