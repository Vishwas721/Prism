import asyncio
import io
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
        # --- DEBUG START ---
        # Check the first 10 bytes (magic bytes) to verify file integrity
        header_check = file_stream[:10] if file_stream else b''
        print(f"DEBUG MAGIC BYTES: {header_check}")
        print(f"DEBUG FILE SIZE: {len(file_stream)} bytes")
        
        # Validate we have actual data
        if len(file_stream) == 0:
            raise RuntimeError("Received 0 bytes - file is empty!")
        
        # Check if it starts with PDF header
        if not file_stream.startswith(b'%PDF'):
            print(f"WARNING: File does not start with PDF magic bytes!")
            print(f"First 50 bytes: {file_stream[:50]}")
        # --- DEBUG END ---
        
        # Convert bytes to file-like object with seek support
        file_obj = io.BytesIO(file_stream)
        
        # Use the file object directly (Azure SDK will handle it properly)
        poller = await asyncio.to_thread(
            client.begin_analyze_document, 
            "prebuilt-read", 
            document=file_obj
        )
        result = await asyncio.to_thread(poller.result)
        return result.content or ""
    except AzureError as exc:
        raise RuntimeError(f"Azure Document Intelligence extraction failed: {exc}") from exc
