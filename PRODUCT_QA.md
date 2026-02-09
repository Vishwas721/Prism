# Prism - Product Q&A (Grounded in Repo)

This document answers the provided questions strictly based on the current codebase and project docs. It avoids claims that are not implemented.

## Level 1: The Basics

**Q1. "Prism is designed to solve the CMS-0057-F 72-hour mandate. How does your system ensure it meets this SLA? Do you have a fallback if the AI fails to process a file within a certain time?"**

**Answer:**
- The system stores `sla_hours` and `sla_remaining_hours` on each case and displays them in the UI, but there is no server-side enforcement or background scheduler that guarantees completion within 72 hours. The SLA is currently a tracking/display field in the data model, not an automated compliance mechanism. See [server/services/patient_service.py](server/services/patient_service.py) and [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md).
- There is no fallback workflow if OCR or LLM processing fails to finish in time. The `/api/analyze` route is a synchronous request path that returns an error on OCR failures and returns an `UNKNOWN` decision on LLM parsing failures. See [server/routes/analyze.py](server/routes/analyze.py) and [server/services/llm_service.py](server/services/llm_service.py).

**Q2. "You used Azure Document Intelligence for OCR. Why pay for Azure here when you used Tesseract/PyMuPDF in SummAID? What specific advantage did Azure give you for medical forms?"**

**Answer:**
- In this repository, OCR is implemented with Azure Document Intelligence `prebuilt-read`. There is no implementation of Tesseract or PyMuPDF in this codebase to compare against. See [server/services/ocr_service.py](server/services/ocr_service.py).
- The codebase does not document a specific measured advantage or benchmark for medical forms. The only stated design is that Azure Document Intelligence is used for PDF-to-text extraction. See [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md).

## Level 2: Agentic Logic

**Q3. "Your resume mentions Prism is a 'Multi-Agent System' (Policy, Extraction, Verdict Agents), but your PRS describes a linear flow: FastAPI -> Azure Doc Intel -> OpenAI. Can you explain where the 'Agents' sit in this architecture? Is it a single prompt doing three jobs, or three separate API calls coordinating with each other?"**

**Answer:**
- The current backend implements a linear flow: OCR (Azure Document Intelligence) -> entity extraction (Azure AI Language healthcare entities) -> single LLM call for decision. This is an orchestrated pipeline, not separate coordinating agents. See [server/routes/analyze.py](server/routes/analyze.py), [server/services/ocr_service.py](server/services/ocr_service.py), [server/services/entity_service.py](server/services/entity_service.py), and [server/services/llm_service.py](server/services/llm_service.py).
- The LLM decision is produced by a single `evaluate_medical_policy` call. There is no multi-agent coordination layer, no separate "Policy", "Extraction", or "Verdict" agents, and no multi-step prompt chain. See [server/services/llm_service.py](server/services/llm_service.py).

**Q4. "You mention using Pydantic to enforce the JSON structure for FHIR output. What happens if the LLM returns a malformed JSON that fails Pydantic validation? Does your system auto-retry (heal), or does it throw an error?"**

**Answer:**
- The LLM output is parsed into the `PolicyDecision` Pydantic model. If JSON parsing or validation fails, the code logs the error and returns a `PolicyDecision` with `status="UNKNOWN"` and the raw content placed in `reason`. There is no auto-retry or self-healing in the current implementation. See [server/services/llm_service.py](server/services/llm_service.py).
- The "FHIR" output in the UI is currently a simplified JSON object containing detected entities, not a full FHIR resource. This is created in the API response. See [server/routes/analyze.py](server/routes/analyze.py).

## Level 3: The "Grill" (Production Readiness)

**Q5. "Medical policies change frequently. Your user flow involves selecting a 'Specific Policy'. How do you ingest these policies? do you RAG the policy document itself, or is it hard-coded into the system prompt?"**

**Answer:**
- Policies are stored in a local JSON file and retrieved by ID at runtime. The policy text is loaded from [server/data/policies.json](server/data/policies.json) and passed directly into the LLM prompt. There is no RAG pipeline or external document ingestion in the current codebase. See [server/services/policy_service.py](server/services/policy_service.py) and [server/routes/analyze.py](server/routes/analyze.py).

**Q6. "You have a 'Verdict Agent' that outputs Approved/Denied. In a real clinical trial setting, false denials are dangerous. How did you evaluate the accuracy of this agent? Did you use a 'Human-in-the-loop' workflow?"**

**Answer:**
- There is no documented accuracy evaluation workflow, test harness, or metrics tracking in this repository. There is also no human-in-the-loop review flow implemented in code.
- The only explicit non-LLM bypass in the system is the Gold Card auto-approval path for providers marked `GOLD_CARD`. This is not an accuracy evaluation mechanism; it is a rule-based bypass. See [server/services/patient_service.py](server/services/patient_service.py).

## Additional Important Questions (Recommended)

These are relevant to production readiness but are not yet implemented in the repo:

1. What is the PHI/PII data retention and deletion policy for uploaded PDFs and extracted text?
2. Do you encrypt files at rest and in transit, and how are access logs/audit trails handled?
3. What is the error budget and retry strategy for Azure OCR, Azure Language, and the LLM API?
4. How do you monitor and alert on SLA breaches or stuck cases (queue timeouts)?
5. What is the rate limiting or concurrency control to prevent overload during batch uploads?
6. How do you validate that evidence quotes map to the correct page/line in the source PDF?
7. What is the plan for policy updates (versioning, approvals, rollback) beyond manual JSON edits?
8. What is the strategy for model drift and ongoing evaluation against ground-truth decisions?
