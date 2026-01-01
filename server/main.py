import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import analyze, policies, patients

load_dotenv()

# --- FastAPI setup ---------------------------------------------------------

app = FastAPI(title="Prism API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze.router)
app.include_router(policies.router)
app.include_router(patients.router)


@app.get("/")
def root():
    return {"service": "prism", "status": "ok"}


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "github_models_configured": bool(os.getenv("GITHUB_TOKEN")),
        "document_intelligence_configured": bool(os.getenv("AZURE_DOC_INTEL_ENDPOINT"))
        and bool(os.getenv("AZURE_DOC_INTEL_KEY")),
        "language_configured": bool(os.getenv("AZURE_LANGUAGE_ENDPOINT"))
        and bool(os.getenv("AZURE_LANGUAGE_KEY")),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
