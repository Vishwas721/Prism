import os
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.ai.textanalytics import TextAnalyticsClient
from azure.core.credentials import AzureKeyCredential
from openai import OpenAI

load_dotenv()

# --- Configuration helpers -------------------------------------------------

def build_openai_client() -> OpenAI:
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        raise RuntimeError("GITHUB_TOKEN is not set; cannot initialize GitHub Models client.")
    return OpenAI(
        base_url="https://models.inference.ai.azure.com",
        api_key=token,
    )


def build_doc_intel_client() -> Optional[DocumentAnalysisClient]:
    endpoint = os.getenv("AZURE_DOC_INTEL_ENDPOINT")
    key = os.getenv("AZURE_DOC_INTEL_KEY")
    if not endpoint or not key:
        return None
    return DocumentAnalysisClient(endpoint=endpoint, credential=AzureKeyCredential(key))


def build_language_client() -> Optional[TextAnalyticsClient]:
    endpoint = os.getenv("AZURE_LANGUAGE_ENDPOINT")
    key = os.getenv("AZURE_LANGUAGE_KEY")
    if not endpoint or not key:
        return None
    return TextAnalyticsClient(endpoint=endpoint, credential=AzureKeyCredential(key))


# --- Clients ---------------------------------------------------------------

openai_client = build_openai_client()  # GitHub Models at inference.ai.azure.com

document_intel_client = build_doc_intel_client()
language_client = build_language_client()


# --- FastAPI setup ---------------------------------------------------------

app = FastAPI(title="Prism API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_NAME = "gpt-4o"


class PromptRequest(BaseModel):
    prompt: str


@app.get("/")
def root():
    return {"service": "prism", "status": "ok"}


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "github_models_client": True,
        "document_intelligence_configured": document_intel_client is not None,
        "language_configured": language_client is not None,
    }


@app.post("/ai/complete")
async def complete_prompt(body: PromptRequest):
    if not body.prompt:
        raise HTTPException(status_code=400, detail="Prompt cannot be empty.")

    response = openai_client.responses.create(
        model=MODEL_NAME,
        input=body.prompt,
    )
    # GitHub Models Responses API returns structured content; flatten to a string.
    message = "".join(
        part.text
        for output in response.output or []
        for part in output.content
        if getattr(part, "type", None) == "output_text"
    )
    return {"output": message}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
