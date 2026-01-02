# PRISM - Medical Authorization Review System
## Complete Project Overview & Architecture

---

## 1. PROJECT SUMMARY

**Project Name:** Prism  
**Purpose:** Medical Prior Authorization Review Dashboard - AI-powered system for nurses/claims reviewers to manage, analyze, and approve medical authorization requests.  
**Tech Stack:** 
- **Frontend:** React 18 + Vite + React Router v6 + Tailwind CSS
- **Backend:** FastAPI + Python 3.11
- **AI Services:** Azure Document Intelligence, Azure Text Analytics, GitHub Models (gpt-4o)
- **Deployment:** Zero-cost (Azure Free Tier + GitHub Models)

**Current Status:** MVP Complete - All core features implemented

---

## 2. SYSTEM ARCHITECTURE

### 2.1 Frontend Architecture
```
client/
├── src/
│   ├── App.jsx                    # Main router component
│   ├── main.jsx                   # React entry point
│   ├── styles.css                 # Global styles + medical theme
│   ├── components/
│   │   ├── FileUpload.jsx         # Drag-drop file selector
│   │   ├── StatusBadge.jsx        # Status indicator (APPROVED, DENIED, NEEDS INFO)
│   │   ├── JsonViewer.jsx         # FHIR JSON formatter
│   │   └── PolicySelector.jsx     # Dynamic policy dropdown
│   └── pages/
│       ├── Dashboard.jsx          # Patient queue/inbox list view
│       ├── CaseDetail.jsx         # Split-screen workboard (case review + PDF viewer)
│       └── QuickAnalysis.jsx      # Single-file upload for quick testing
├── package.json                    # Dependencies: axios, framer-motion, react-router-dom
└── vite.config.js                  # Vite bundler config
```

### 2.2 Backend Architecture
```
server/
├── main.py                         # FastAPI app + static file serving
├── models.py                       # Pydantic data models
├── requirements.txt                # Python dependencies
├── routes/
│   ├── analyze.py                 # POST /api/analyze orchestration
│   ├── policies.py                # GET /api/policies endpoints
│   └── patients.py                # GET/POST patient case management
├── services/
│   ├── ocr_service.py             # Azure Document Intelligence (PDF → text)
│   ├── entity_service.py          # Azure Text Analytics (healthcare entities)
│   ├── llm_service.py             # GitHub Models (policy evaluation + reasoning)
│   ├── policy_service.py          # Policy library management
│   └── patient_service.py         # Patient case CRUD
├── data/
│   ├── policies.json              # 3 pre-loaded policies (Medicare, Aetna, UHC)
│   └── patients.json              # Patient cases database
└── uploads/                        # Uploaded PDF files stored here
```

---

## 3. CURRENT PAGES & UI STRUCTURE

### 3.1 DASHBOARD PAGE (Route: `/`)
**Purpose:** Patient queue/inbox view - nurses see all cases with SLA countdown

**Layout:**
- Header with "PRISM - Nurse Queue" title and "+ New Case" button
- Single-column card with patient table
- Table columns: Case ID | Patient Name | Policy | Received | SLA | Status
- 3 pre-loaded demo cases:
  1. Joe Doe (APPROVED, 71h SLA remaining) - Green badge
  2. Jane Smith (ACTION_REQUIRED/NEEDS INFO, 48h SLA) - Amber badge
  3. Robert Langdon (PENDING, 72h SLA) - Gray badge

**Features:**
- Clickable rows → navigate to `/case/{id}`
- SLA color coding:
  - Red pulse animation: < 24 hours (urgent)
  - Yellow: < 48 hours (warning)
  - Gray: Normal
- "+ New Case" modal with:
  - Patient Name input
  - Policy dropdown (dynamic from API)
  - File upload (drag-drop)
  - Upload button

**Current Style:**
- Medical blue/slate color scheme
- Table rows have hover effect
- SLA has animated pulse for urgent cases
- Modal overlay with semi-transparent background

---

### 3.2 CASE DETAIL PAGE (Route: `/case/:id`)
**Purpose:** Workboard for reviewing individual cases - split-screen design

**Default State (Before clicking Evidence):**
- **Left Side:** Empty (placeholder message removed)
- **Right Side:** Full-width patient case details
  - Header: Patient name + Policy name + Status badge
  - Case Info: Case ID, Received date, SLA remaining
  - Analysis Results (if analysis completed):
    - **Reasoning Block:** AI decision explanation text
    - **Evidence Quote:** Interactive yellow box - "Click to Verify"
    - **Entities:** Tags showing detected medical entities (e.g., "8 weeks PT", "Ibuprofen")
    - **Actions Section:**
      - IF APPROVED: "Generate FHIR Resource" button (Indigo) + "View JSON" button
      - IF ACTION_REQUIRED: "Smart RFI Email Draft" textarea + "Send Request" button
      - IF PENDING: "Run Analysis" button (in header)

**After Clicking Evidence Quote:**
- Grid changes to 2-column layout (50/50 split)
- **Left:** PDF viewer appears in iframe (Source Document)
  - File loads from backend `/uploads/{filename}`
  - Close button (✕) to collapse back to single column
  - Displays actual patient PDF
- **Right:** Stays same (case details)
  - Evidence quote box now has green border, shows "Evidence Quote (Verified)"

**APPROVED Case Flow:**
1. See case details + reasoning
2. Click "Evidence Quote - Click to Verify" (yellow box)
3. PDF appears on right side
4. Can toggle "View JSON" to see FHIR structure
5. Click "Generate FHIR Resource (HL7)" button:
   - Shows "⚙️ Generating..." for 1.5 seconds
   - File `{case_id}_FHIR.json` downloads
   - Success toast: "✅ FHIR Resource exported successfully!"

**ACTION_REQUIRED Case Flow:**
1. See case details + reasoning
2. Read evidence quote
3. See pre-filled RFI (Request for Information) email draft
4. Can edit draft in textarea
5. Click "Send Request to Provider"
6. Toast confirms "Sent!"

**Current Style:**
- White card-based layout
- Yellow highlight for interactive evidence box
- Green accents for verified/approved
- Responsive grid layout
- Indigo buttons for primary actions

---

### 3.3 QUICK ANALYSIS PAGE (Route: `/analyze`)
**Purpose:** Alternative interface for quick one-off document analysis (testing)

**Layout:**
- Two-column layout (not affected by user preference)
- **Left Column:** Policy + File selection
- **Right Column:** Real-time analysis results
- Animated scanning steps:
  - "Extracting OCR..."
  - "Checking Medical Entities..."
  - "Evaluating Policy..."
- Results display: Status badge + Reasoning + Evidence + Entities + FHIR JSON

**Current Style:**
- Medical theme consistent with dashboard
- Scanning progress bar with animation
- Full FHIR viewer (not conditional)

---

## 4. DATA FLOW & API ENDPOINTS

### 4.1 Core Endpoints

**GET /api/patients**
- Returns: Array of all patient cases
- Used by: Dashboard (load queue)
- Response: `[{ id, patient_name, policy_id, status, sla_hours, sla_remaining_hours, file_path, analysis_result }, ...]`

**GET /api/patients/{id}**
- Returns: Single patient case details
- Used by: CaseDetail (load case)
- Response: Full patient object with nested analysis_result

**POST /api/upload**
- Uploads new patient case
- Params: file, patient_name, policy_id
- Returns: Created patient object with PENDING status
- Saves file to: `uploads/{patient_name}_{filename}`

**GET /api/policies**
- Returns: Array of available policies
- Used by: PolicySelector dropdown
- Response: `[{ id, name, description }, ...]`

**GET /api/policies/{id}**
- Returns: Full policy text + details
- Used by: Analysis orchestration
- Response: `{ id, name, description, text }`

**POST /api/analyze**
- Orchestrates full analysis pipeline
- Params: file OR patient_id, policy_id
- Flow:
  1. PDF text extraction (Azure OCR)
  2. Medical entity extraction (Azure NLP)
  3. Policy evaluation (GitHub Models LLM)
  4. Decision determination + evidence quote + RFI draft generation
- Returns: `AnalysisResult { status, reasoning, evidence_quote, rfi_draft, entities_detected, fhir_json }`

**GET /uploads/{filename}**
- Serves static PDF files
- Browser can iframe these for display
- Mounted at `/uploads` path in main.py

### 4.2 Data Models

**Patient Case Object:**
```json
{
  "id": "case-001",
  "patient_name": "Joe Doe",
  "policy_id": "medicare-knee-mri",
  "policy_name": "Medicare (CMS) - Knee MRI",
  "status": "APPROVED|PENDING|ACTION_REQUIRED|DENIED",
  "received_date": "2026-01-01T08:00:00Z",
  "sla_hours": 72,
  "sla_remaining_hours": 71,
  "file_path": "uploads/joe_doe_file.pdf",
  "analysis_result": {
    "status": "APPROVED",
    "reasoning": "Full explanation...",
    "evidence_quote": "Direct quote from document...",
    "rfi_draft": "Email draft if ACTION_REQUIRED...",
    "entities_detected": ["8 weeks", "physical therapy", "..."],
    "fhir_json": { "entities": [...] }
  }
}
```

**Policy Object:**
```json
{
  "id": "medicare-knee-mri",
  "name": "Medicare (CMS) - Knee MRI Guidelines",
  "description": "Coverage criteria for knee MRI under CMS...",
  "text": "Full policy document text..."
}
```

**AnalysisResult (from POST /api/analyze):**
```json
{
  "status": "APPROVED|DENIED|ACTION_REQUIRED|UNKNOWN",
  "reasoning": "Detailed explanation of decision",
  "evidence_quote": "Exact quote from patient document",
  "rfi_draft": "Email template if more info needed",
  "entities_detected": ["Entity1", "Entity2", ...],
  "fhir_json": { "entities": [...] }
}
```

---

## 5. CURRENT UI/UX DESIGN SYSTEM

### 5.1 Color Palette
```
Primary Colors:
- Indigo (#4f46e5) - Buttons, primary actions
- Slate (#0f172a) - Text/headers
- Blue (#0ea5e9) - Accents

Status Colors:
- Green (#22c55e) - APPROVED, success
- Red (#ef4444) - DENIED, urgent SLA
- Amber (#f59e0b) - ACTION_REQUIRED, warning SLA
- Gray (#6b7280) - PENDING, neutral

Background:
- Light slate (#f8fafc) - Page background
- White (#ffffff) - Cards
- Gray (#f3f4f6) - Secondary elements
```

### 5.2 Component Styling
**Status Badge:**
- Font size: 1.1rem, Bold (700)
- Padding: 8px 12px
- Border radius: 6px
- Maps status to color:
  - APPROVED → Green
  - DENIED → Red
  - NEEDS INFO (ACTION_REQUIRED) → Amber
  - PENDING → Gray

**Evidence Quote Box (Interactive):**
- Default: Yellow (#fef3c7) border, background
- After click: Green (#f0fdf4) border, background
- Cursor pointer on hover
- Smooth transition (0.3s ease)
- Includes emoji icon (🔎)
- Clickable role + keyboard accessible

**Table (Dashboard):**
- Striped rows with hover highlight
- SLA column has animated pulse for urgent cases
- Status badges inline in table
- Clickable rows with pointer cursor

**Modal (New Case):**
- Semi-transparent overlay (#000 with opacity)
- White card centered
- Header + Body + Footer structure
- Close button (✕) in top right
- Blur background effect

**Buttons:**
- Primary (Indigo): Solid background, white text, 10px 16px padding
- Secondary (Gray): Border + light background, 10px 16px padding
- Active states: Darker on hover
- Disabled state: Gray (#9ca3af), cursor not-allowed

**Animations:**
- Pulse animation for urgent SLA (< 24h)
  - 2-second loop, increases opacity
- Spin animation for loading spinner (1s linear infinite)
- Framer Motion for scanner steps (0.3s fade in/out)

### 5.3 Layout
**Desktop-First Responsive:**
- Max width container: 1200px
- Grid layouts for multi-column views
- Padding: 32px top/bottom, 24px left/right
- Gap between sections: 16px

**Grid Patterns:**
- Dashboard: Single column (full width table)
- CaseDetail: Dynamic (1fr when no PDF, 1fr 1fr when PDF open)
- QuickAnalysis: Static 2-column (left input, right results)

---

## 6. CURRENT USER WORKFLOWS

### Workflow 1: Review Approved Case
1. Nurse opens Dashboard (sees queue of 3 cases)
2. Clicks "Joe Doe" row → navigates to CaseDetail
3. Right column shows full case info + green "APPROVED" badge
4. Reads AI reasoning
5. Clicks yellow "Evidence Quote - Click to Verify" box
6. PDF appears on right side
7. Reads the actual document quote
8. Clicks "Generate FHIR Resource (HL7)" button
9. System shows "⚙️ Generating..." for 1.5 seconds
10. `case-001_FHIR.json` downloads to computer
11. Success toast appears: "✅ FHIR Resource exported successfully!"

### Workflow 2: Handle ACTION_REQUIRED Case
1. Nurse opens Dashboard
2. Clicks "Jane Smith" row (Amber "NEEDS INFO" badge)
3. Right column shows case + amber badge + reasoning
4. Sees pre-filled RFI email draft in textarea
5. Edits draft if needed (adds specific requests)
6. Clicks "Send Request to Provider"
7. Toast confirms "Sent!"
8. Can click "View JSON" to see FHIR structure for records

### Workflow 3: Analyze New Case
1. Nurse clicks "+ New Case" button
2. Modal appears
3. Enters patient name
4. Selects policy from dropdown
5. Uploads PDF (drag-drop or click)
6. Clicks "Upload Case"
7. New PENDING case appears in dashboard
8. Clicks case to view
9. Clicks "Run Analysis" button
10. Animated scanner: "Extracting OCR..." → "Checking Entities..." → "Evaluating Policy..."
11. Results appear (status, reasoning, evidence, entities)
12. Case status updates from PENDING to APPROVED/DENIED/ACTION_REQUIRED

### Workflow 4: Quick Test (QuickAnalysis)
1. Nurse navigates to `/analyze` route
2. Selects policy from dropdown
3. Uploads test PDF
4. Clicks "Run Analysis"
5. Real-time results display on right
6. Can view FHIR JSON
7. No data saved to database

---

## 7. CURRENT STYLING ISSUES & LIMITATIONS

### UI/UX Problems:
1. **Dashboard:** 
   - Table is plain/basic
   - No visual hierarchy between cases
   - SLA countdown doesn't update in real-time
   - Modal is functional but not visually polished

2. **CaseDetail:**
   - Too much text in reasoning block (hard to scan)
   - Evidence quote box styling could be more prominent
   - FHIR JSON viewer is raw JSON (not formatted nicely)
   - No visual separation between sections
   - PDF viewer is basic iframe

3. **Components:**
   - StatusBadge is simple pill (could be more expressive)
   - FileUpload lacks visual polish (no progress bar)
   - JsonViewer is plain `<pre>` tag (hard to read)
   - PolicySelector is basic `<select>`

4. **Overall:**
   - Medical theme is present but not cohesive
   - Missing visual hierarchy
   - Limited use of whitespace
   - No micro-interactions (hover states, transitions)
   - Typography could be stronger
   - Icons could be more consistent

---

## 8. TECHNICAL DETAILS

### 8.1 Frontend Stack
- **React 18:** Component-based UI
- **Vite 5:** Fast build tool + dev server
- **React Router v6:** Client-side navigation
- **Axios:** HTTP client for API calls
- **Framer Motion:** Animation library (scanner steps)
- **Tailwind Merge:** CSS utility merging
- **clsx:** Conditional class names

### 8.2 Backend Stack
- **FastAPI:** Modern Python web framework
- **Uvicorn:** ASGI server
- **Pydantic:** Data validation + models
- **Azure AI Services:**
  - DocumentAnalysisClient (OCR)
  - TextAnalyticsClient (NLP entity extraction)
- **OpenAI SDK:** GitHub Models integration (gpt-4o)

### 8.3 Environment Variables Required
```
# Backend (server/.env)
AZURE_DOC_INTEL_ENDPOINT=https://[region].api.cognitive.microsoft.com/
AZURE_DOC_INTEL_KEY=your_key_here
AZURE_LANGUAGE_ENDPOINT=https://[region].api.cognitive.microsoft.com/
AZURE_LANGUAGE_KEY=your_key_here
GITHUB_TOKEN=your_github_token

# Frontend (client/.env or inline)
VITE_API_URL=http://localhost:8000
```

### 8.4 Current Data Storage
- **patients.json:** JSON file (in-memory on startup, written when updated)
- **policies.json:** 3 hard-coded policies
- **uploads/:** PDF files stored on disk
- **No database:** Simple file-based (MVP only)

---

## 9. API RESPONSE EXAMPLES

### GET /api/patients
```json
[
  {
    "id": "case-001",
    "patient_name": "Joe Doe",
    "policy_id": "medicare-knee-mri",
    "policy_name": "Medicare (CMS) - Knee MRI",
    "status": "APPROVED",
    "received_date": "2026-01-01T08:00:00Z",
    "sla_hours": 72,
    "sla_remaining_hours": 71,
    "file_path": "uploads/joe_doe.pdf",
    "analysis_result": {
      "status": "APPROVED",
      "reasoning": "Patient meets all criteria...",
      "evidence_quote": "Patient completed 8 weeks of supervised PT...",
      "rfi_draft": "",
      "entities_detected": ["8 weeks", "physical therapy", "X-ray"],
      "fhir_json": {"entities": ["8 weeks", "physical therapy", "X-ray"]}
    }
  },
  ...
]
```

### POST /api/analyze
**Request:**
```
FormData:
- patient_id: "case-004"
- policy_id: "medicare-knee-mri"
(no file needed - reads from disk)
```

**Response:**
```json
{
  "status": "APPROVED",
  "reasoning": "Patient demonstrates...",
  "evidence_quote": "Exact quote from PDF",
  "rfi_draft": "",
  "entities_detected": ["entity1", "entity2"],
  "fhir_json": {"entities": ["entity1", "entity2"]}
}
```

---

## 10. FEATURE CHECKLIST (MVP COMPLETE)

- ✅ Dashboard: Patient queue with table + SLA countdown
- ✅ Case Details: Full case review workboard
- ✅ PDF Viewer: Click-to-reveal glass box verification
- ✅ Analysis Pipeline: OCR → Entities → LLM reasoning
- ✅ Smart RFI: Auto-generated email drafts for ACTION_REQUIRED cases
- ✅ Evidence Quotes: Direct quotes from documents for verification
- ✅ FHIR Export: JSON download for approved cases
- ✅ Policy Library: 3 policies (Medicare, Aetna, UHC)
- ✅ Static File Serving: PDF uploads accessible via browser
- ✅ Status Badges: Visual indicators for case status
- ✅ SLA Tracking: Color-coded countdown timers
- ✅ New Case Upload: Modal with drag-drop file selection
- ✅ Real-time Updates: API fetches latest data
- ✅ Responsive Layout: Grid-based adaptive design

---

## 11. NEXT STEPS FOR UI/UX IMPROVEMENT

### Areas Needing Enhancement:
1. **Typography:** Better hierarchy, larger headings, varied font weights
2. **Color:** More vibrant, better contrast, emotional resonance
3. **Spacing:** Increased whitespace, better card separation
4. **Components:** 
   - Richer status badges (icons, animations)
   - Polished file upload (progress bars, drag state)
   - Formatted JSON viewer (syntax highlighting)
   - Better table with sorting/filtering
5. **Micro-interactions:** 
   - Button hover states
   - Loading states
   - Success animations
   - Transition effects
6. **Visual Elements:**
   - Icons (heroicons, lucide)
   - Illustrations
   - Gradients
   - Shadows/depth
7. **Information Architecture:**
   - Dashboard card grouping
   - Better case prioritization
   - Section organization on detail page
   - Progressive disclosure

---

## Summary

**Prism is a fully functional MVP** with all core features working end-to-end. The system successfully:
- Manages patient cases with SLA tracking
- Processes PDFs through AI pipeline (OCR → NLP → LLM)
- Generates decisions with evidence quotes and RFI drafts
- Exports FHIR resources
- Provides split-screen workboard for case review

**The UI/UX is functional but basic.** It needs visual polish, better typography, more cohesive design, and enhanced micro-interactions to match enterprise medical software standards.

This document provides all technical and UX details needed for wireframing improvements.
