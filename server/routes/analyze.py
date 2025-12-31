import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from models import AnalysisResult
from services import entity_service, llm_service, ocr_service

router = APIRouter(prefix="/api", tags=["analyze"])
logger = logging.getLogger("prism.analyze")


@router.post("/analyze", response_model=AnalysisResult)
async def analyze_document(file: UploadFile = File(...), policy_text: str = Form(...)):
    # Step 0: Read file
    try:
        file_bytes = await file.read()
    except Exception as exc:  # pragma: no cover - runtime I/O
        logger.exception("Failed to read uploaded file")
        raise HTTPException(status_code=400, detail="Failed to read document") from exc

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

    return AnalysisResult(
        status=decision.status,
        reasoning=decision.reason,
        entities_detected=entities,
        fhir_json={"entities": entities},
    )
