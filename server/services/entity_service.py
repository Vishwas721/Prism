import asyncio
import os
from typing import Dict, List, Optional

from azure.ai.textanalytics import TextAnalyticsClient
from azure.core.credentials import AzureKeyCredential
from azure.core.exceptions import AzureError
from dotenv import load_dotenv

load_dotenv()

_language_client: Optional[TextAnalyticsClient] = None


def _get_language_client() -> TextAnalyticsClient:
    global _language_client
    if _language_client:
        return _language_client

    endpoint = os.getenv("AZURE_LANGUAGE_ENDPOINT")
    key = os.getenv("AZURE_LANGUAGE_KEY")
    if not endpoint or not key:
        raise RuntimeError("Azure Language credentials are missing.")

    _language_client = TextAnalyticsClient(endpoint=endpoint, credential=AzureKeyCredential(key))
    return _language_client


async def extract_medical_entities(text: str) -> Dict[str, List[str]]:
    """Extract healthcare entities from text using Azure AI Language healthcare analysis."""
    if not text:
        return {"entities": []}

    client = _get_language_client()

    try:
        poller = await asyncio.to_thread(client.begin_analyze_healthcare_entities, [text])
        result = await asyncio.to_thread(poller.result)
    except AzureError as exc:
        raise RuntimeError(f"Azure AI Language healthcare analysis failed: {exc}") from exc

    entities: List[str] = []
    for doc in result:
        if getattr(doc, "is_error", False):
            raise RuntimeError(f"Healthcare analysis error: {doc.error}")
        for entity in getattr(doc, "entities", []):
            if entity.text:
                entities.append(entity.text)

    return {"entities": entities}
