import asyncio
import os
from typing import Optional

from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential
from azure.core.exceptions import AzureError
from dotenv import load_dotenv

load_dotenv()

_doc_client: Optional[DocumentAnalysisClient] = None


def _get_doc_client() -> DocumentAnalysisClient:
    global _doc_client
    if _doc_client:
        return _doc_client

    endpoint = os.getenv("AZURE_DOC_INTEL_ENDPOINT")
    key = os.getenv("AZURE_DOC_INTEL_KEY")
    if not endpoint or not key:
        raise RuntimeError("Azure Document Intelligence credentials are missing.")

    _doc_client = DocumentAnalysisClient(endpoint=endpoint, credential=AzureKeyCredential(key))
    return _doc_client


async def extract_text_from_pdf(file_stream: bytes) -> str:
    """Extract text from a PDF using Azure Document Intelligence prebuilt-read."""
    client = _get_doc_client()

    try:
        poller = await asyncio.to_thread(client.begin_analyze_document, "prebuilt-read", document=file_stream)
        result = await asyncio.to_thread(poller.result)
        return result.content or ""
    except AzureError as exc:
        raise RuntimeError(f"Azure Document Intelligence extraction failed: {exc}") from exc
