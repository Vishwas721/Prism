import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import JsonViewer from '../components/JsonViewer'
import PdfViewer from '../components/PdfViewer'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import { useToast } from '../components/Toast'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// RFI Template options
const RFI_TEMPLATES = [
  {
    id: 'medical-records',
    name: 'Medical Records Request',
    content: `Dear Healthcare Provider,

We are reviewing the prior authorization request for the patient referenced above. To complete our review, we require the following additional documentation:

• Complete medical records for the past 12 months
• Lab results and diagnostic imaging reports
• Physician's clinical notes supporting medical necessity

Please submit the requested documentation within 5 business days. If you have any questions, please contact our Prior Authorization department.

Thank you for your prompt attention to this matter.`
  },
  {
    id: 'clinical-notes',
    name: 'Clinical Notes Request',
    content: `Dear Healthcare Provider,

We are unable to complete the authorization review due to insufficient clinical documentation. Please provide:

• Detailed clinical notes explaining the medical necessity
• Treatment history and outcomes of previous therapies
• Current treatment plan and expected outcomes

This information is essential for our medical review team to make an informed decision.

Please respond within 5 business days.`
  },
  {
    id: 'lab-results',
    name: 'Lab Results Request',
    content: `Dear Healthcare Provider,

To proceed with the authorization review, we need the following laboratory documentation:

• Recent lab work (within the last 30 days)
• Relevant diagnostic test results
• Any imaging studies performed

Please submit these documents at your earliest convenience.

Thank you for your cooperation.`
  }
]

const CaseDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [patient, setPatient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [rfiDraft, setRfiDraft] = useState('')
  const [showFhir, setShowFhir] = useState(false)
  const [showPdf, setShowPdf] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [evidenceActive, setEvidenceActive] = useState(false)
  const [evidencePage, setEvidencePage] = useState(1)
  const [rfiSending, setRfiSending] = useState(false)
  const [rfiSent, setRfiSent] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)

  useEffect(() => {
    fetchPatient()
  }, [id])

  const fetchPatient = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/patients/${id}`)
      setPatient(response.data)
      if (response.data.analysis_result?.rfi_draft) {
        setRfiDraft(response.data.analysis_result.rfi_draft)
      }
      // Check if RFI was already sent
      if (response.data.rfi_sent) {
        setRfiSent(true)
        if (response.data.rfi_message) {
          setRfiDraft(response.data.rfi_message)
        }
      }
      // Extract evidence page if available (from AI response)
      if (response.data.analysis_result?.evidence_page) {
        setEvidencePage(response.data.analysis_result.evidence_page)
      }
    } catch (error) {
      console.error('Failed to load patient:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEvidenceClick = () => {
    setEvidenceActive(true)
    setShowPdf(true)
  }

  const handleAnalyze = async () => {
    if (!patient) return

    setAnalyzing(true)
    const formData = new FormData()
    // patient_id tells the backend to load the stored PDF from disk
    formData.append('patient_id', patient.id)
    formData.append('policy_id', patient.policy_id)

    try {
      const response = await axios.post(`${API_URL}/api/analyze`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      
      // Refresh patient data
      await fetchPatient()
    } catch (error) {
      console.error('Failed to analyze:', error)
      alert('Failed to analyze document')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSendRfi = async () => {
    if (!rfiDraft.trim()) {
      toast.error('Please enter a message before sending')
      return
    }
    
    setRfiSending(true)
    
    try {
      // Send RFI to backend
      const formData = new FormData()
      formData.append('message', rfiDraft)
      
      await axios.post(`${API_URL}/api/patients/${patient.id}/send-rfi`, formData)
      
      setRfiSent(true)
      toast.success('Request sent to healthcare provider!')
    } catch (error) {
      console.error('Failed to send RFI:', error)
      toast.error('Failed to send request. Please try again.')
    } finally {
      setRfiSending(false)
    }
  }

  const handleUseTemplate = (template) => {
    setRfiDraft(template.content)
    setShowTemplates(false)
    toast.success(`"${template.name}" template applied`)
  }

  const handleExport = async () => {
    setIsExporting(true)
    
    try {
      // Simulate processing
      await new Promise((resolve) => setTimeout(resolve, 1000))
      
      if (!patient || !result?.fhir_json) {
        toast.error('No FHIR data available for export')
        setIsExporting(false)
        return
      }
      
      // Create JSON blob
      const jsonString = JSON.stringify(result.fhir_json, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })
      
      // Generate filename
      const filename = `${patient.id}_FHIR.json`
      
      // Create download link
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      toast.success('FHIR Resource exported successfully!')
    } catch (error) {
      toast.error('Failed to export FHIR data')
    } finally {
      setIsExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="page" style={{ padding: '24px 40px' }}>
        <LoadingSpinner size={48} text="Loading case details..." />
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="page" style={{ padding: '24px 40px' }}>
        <EmptyState
          type="error"
          title="Case not found"
          description="The case you're looking for doesn't exist or may have been removed."
          action={{
            label: 'Back to Dashboard',
            onClick: () => navigate('/')
          }}
        />
      </div>
    )
  }

  const result = patient.analysis_result
  const fileUrl = patient?.file_path
    ? `${API_URL}/${patient.file_path.replace(/\\/g, '/').replace(/^\//, '')}`
    : null

  // Status badge styles
  const getStatusStyle = (status) => {
    const normalized = (status || '').toUpperCase()
    if (normalized === 'AUTO_APPROVED') return { bg: '#0EA5E9', icon: '⚡' }
    if (normalized === 'APPROVED') return { bg: '#059669', icon: '✓' }
    if (normalized === 'DENIED') return { bg: '#dc2626', icon: '✕' }
    if (normalized === 'ACTION_REQUIRED') return { bg: '#d97706', icon: '!' }
    return { bg: '#64748b', icon: '?' }
  }

  const statusStyle = getStatusStyle(patient.status)
  const isActionRequired = result?.status === 'ACTION_REQUIRED'

  return (
    <div className="case-detail-page">
      {/* Top Navigation Bar */}
      <header className="case-detail-nav">
        <button className="back-btn" onClick={() => navigate('/')}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Back to Queue</span>
        </button>
        <div className="case-meta">
          <span className="case-id-badge">Case #{patient.id}</span>
          <span className="case-date">
            Received {new Date(patient.received_date).toLocaleDateString('en-US', { 
              month: 'short', day: 'numeric', year: 'numeric' 
            })}
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="case-detail-layout">
        {/* Left Column - Main Content */}
        <main className={`case-main-content ${showPdf ? 'with-pdf' : ''}`}>
          {/* Patient Header Card */}
          <motion.section 
            className="patient-header-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="patient-info">
              <div className="patient-avatar">
                {patient.patient_name.charAt(0).toUpperCase()}
              </div>
              <div className="patient-details">
                <h1 className="patient-name-large">{patient.patient_name}</h1>
                <p className="policy-badge">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1l6 3v4c0 3.5-2.5 5.5-6 7-3.5-1.5-6-3.5-6-7V4l6-3z" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                  {patient.policy_name}
                </p>
              </div>
            </div>
            <div 
              className={`status-chip status-${patient.status?.toLowerCase().replace('_', '-')}`}
            >
              <span className="status-icon">{statusStyle.icon}</span>
              <span>
                {patient.status === 'ACTION_REQUIRED' 
                  ? 'Action Required' 
                  : patient.status === 'AUTO_APPROVED' 
                  ? 'Gold Card' 
                  : patient.status}
              </span>
            </div>
          </motion.section>

          {/* Pending State */}
          {patient.status === 'PENDING' && (
            <motion.section 
              className="pending-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <div className="pending-illustration">
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                  <circle cx="40" cy="40" r="36" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="2"/>
                  <path d="M28 40l8 8 16-16" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h2 className="pending-heading">Ready for AI Analysis</h2>
              <p className="pending-text">
                Submit this case for automated policy evaluation. Our AI will analyze the clinical documentation 
                against insurance guidelines and provide a recommendation.
              </p>
              <button className="analyze-button" onClick={handleAnalyze} disabled={analyzing}>
                {analyzing ? (
                  <>
                    <LoadingSpinner size={20} inline />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2"/>
                      <path d="M14 14l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <span>Run AI Analysis</span>
                  </>
                )}
              </button>
            </motion.section>
          )}

          {/* Analysis Results */}
          {result && (
            <>
              {/* AI Decision Summary */}
              <motion.section 
                className="decision-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <div className="card-header-row">
                  <h2 className="card-title">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M10 2a8 8 0 100 16 8 8 0 000-16z" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M10 6v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    AI Decision Summary
                  </h2>
                </div>
                
                {(result.summary || result.reasoning) && (
                  <div className="decision-summary">
                    <p>{result.summary || result.reasoning}</p>
                  </div>
                )}

                {/* Checklist Grid */}
                <div className="checklist-grid">
                  <div className={`checklist-card ${result.criteria_met ? 'success' : 'error'}`}>
                    <div className="checklist-icon">
                      {result.criteria_met ? '✓' : '✕'}
                    </div>
                    <div className="checklist-info">
                      <span className="checklist-label">Clinical Criteria</span>
                      <span className="checklist-value">
                        {result.criteria_met ? 'Met' : 'Not Met'}
                      </span>
                    </div>
                  </div>

                  <div className={`checklist-card ${result.documentation_complete ? 'success' : result.documentation_complete === false ? 'error' : 'warning'}`}>
                    <div className="checklist-icon">
                      {result.documentation_complete ? '✓' : result.documentation_complete === false ? '✕' : '!'}
                    </div>
                    <div className="checklist-info">
                      <span className="checklist-label">Documentation</span>
                      <span className="checklist-value">
                        {result.documentation_complete ? 'Complete' : 'Incomplete'}
                      </span>
                    </div>
                  </div>

                  <div className={`checklist-card ${result.policy_match ? 'success' : 'warning'}`}>
                    <div className="checklist-icon">
                      {result.policy_match ? '✓' : '?'}
                    </div>
                    <div className="checklist-info">
                      <span className="checklist-label">Policy Match</span>
                      <span className="checklist-value">
                        {result.policy_match ? 'Aligned' : 'Under Review'}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.section>

              {/* Evidence Card */}
              {result.evidence_quote && (
                <motion.section 
                  className="evidence-section"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                >
                  <div className="card-header-row">
                    <h2 className="card-title">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M7 6h6M7 10h6M7 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      Supporting Evidence
                    </h2>
                    {evidenceActive && (
                      <span className="linked-badge">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M6 8l2-2M5 9l-1 1a2 2 0 002.83 2.83l1-1M9 5l1-1a2 2 0 00-2.83-2.83l-1 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        Linked to Page {evidencePage}
                      </span>
                    )}
                  </div>
                  
                  <motion.blockquote 
                    className={`evidence-blockquote ${evidenceActive ? 'active' : ''}`}
                    whileHover={{ scale: 1.005 }}
                    onClick={handleEvidenceClick}
                  >
                    <svg className="quote-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M10 8H6a2 2 0 00-2 2v4a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H6l2-4zm10 0h-4a2 2 0 00-2 2v4a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2l2-4z" fill="currentColor" opacity="0.15"/>
                    </svg>
                    <p>{result.evidence_quote}</p>
                  </motion.blockquote>

                  <div className="evidence-footer">
                    <button 
                      className={`verify-source-btn ${evidenceActive ? 'active' : ''}`}
                      onClick={handleEvidenceClick}
                    >
                      {evidenceActive ? (
                        <>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
                            <path d="M5.5 8l2 2 3-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Viewing Source
                        </>
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <circle cx="7" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
                            <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                          Verify in Document
                        </>
                      )}
                    </button>
                    {evidenceActive && (
                      <button className="unlink-source-btn" onClick={() => setEvidenceActive(false)}>
                        Unlink
                      </button>
                    )}
                  </div>
                </motion.section>
              )}

              {/* Medical Entities */}
              {result.entities_detected?.length > 0 && (
                <motion.section 
                  className="entities-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.25 }}
                >
                  <div className="card-header-row">
                    <h2 className="card-title">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M10 2v16M2 10h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5"/>
                      </svg>
                      Medical Entities Detected
                    </h2>
                    <span className="entity-count">{result.entities_detected.length} found</span>
                  </div>
                  <div className="entity-chips">
                    {result.entities_detected.map((entity, idx) => (
                      <motion.span 
                        key={idx} 
                        className="entity-chip"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 + idx * 0.05 }}
                      >
                        {entity}
                      </motion.span>
                    ))}
                  </div>
                </motion.section>
              )}

              {/* Quick Actions Bar */}
              <motion.section 
                className="quick-actions"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
              >
                <button 
                  className="action-btn secondary"
                  onClick={() => setShowPdf(!showPdf)}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <rect x="2" y="1" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M5 5h8M5 9h8M5 13h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  {showPdf ? 'Hide Document' : 'View Document'}
                </button>
                <button 
                  className="action-btn secondary"
                  onClick={() => setShowFhir(!showFhir)}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M3 5l3-3 3 3M3 13l3 3 3-3M15 5l-3-3-3 3M15 13l-3 3-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {showFhir ? 'Hide FHIR' : 'View FHIR JSON'}
                </button>
                {result.status === 'APPROVED' && (
                  <button 
                    className="action-btn primary"
                    onClick={handleExport}
                    disabled={isExporting}
                  >
                    {isExporting ? (
                      <>
                        <LoadingSpinner size={16} inline />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                          <path d="M9 2v10M5 8l4 4 4-4M3 14h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Export FHIR
                      </>
                    )}
                  </button>
                )}
              </motion.section>

              {/* FHIR JSON Viewer */}
              <AnimatePresence>
                {showFhir && (
                  <motion.section 
                    className="fhir-section"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <JsonViewer data={result.fhir_json} />
                  </motion.section>
                )}
              </AnimatePresence>
            </>
          )}
        </main>

        {/* RFI Section - Separate Prominent Card */}
        {isActionRequired && (
          <motion.aside 
            className="rfi-panel"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <div className="rfi-header">
              <div className="rfi-icon-wrapper">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 7v5M12 15v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <h2 className="rfi-title">Additional Information Required</h2>
                <p className="rfi-subtitle">Send a request to the healthcare provider</p>
              </div>
            </div>

            <div className="rfi-body">
              <div className="rfi-reason">
                <span className="reason-label">Reason for Request</span>
                <p className="reason-text">
                  {result?.missing_documentation || result?.missing_criteria || 
                   'Additional clinical documentation is needed to complete the authorization review.'}
                </p>
              </div>

              <div className="rfi-compose">
                <label className="compose-label">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M13 2.5l.5.5-8 8-2 .5.5-2 8-8 .5.5zM11 4.5l1 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Draft Message
                </label>
                <textarea
                  className="rfi-textarea-new"
                  value={rfiDraft}
                  onChange={(e) => setRfiDraft(e.target.value)}
                  rows={6}
                  placeholder="Compose your request for additional information..."
                />
              </div>

              {/* Template Picker */}
              <AnimatePresence>
                {showTemplates && (
                  <motion.div 
                    className="template-picker"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <div className="template-picker-header">
                      <span>Choose a Template</span>
                      <button onClick={() => setShowTemplates(false)}>✕</button>
                    </div>
                    {RFI_TEMPLATES.map(template => (
                      <button 
                        key={template.id}
                        className="template-option"
                        onClick={() => handleUseTemplate(template)}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                          <path d="M5 6h6M5 8h6M5 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        {template.name}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="rfi-actions">
                {rfiSent ? (
                  <motion.div 
                    className="rfi-sent-success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <div className="sent-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" fill="#059669"/>
                        <path d="M8 12l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div className="sent-content">
                      <span className="sent-title">Request Sent Successfully</span>
                      <span className="sent-subtitle">The provider has been notified</span>
                    </div>
                  </motion.div>
                ) : (
                  <>
                    <button 
                      className={`rfi-send-btn ${rfiSending ? 'sending' : ''}`}
                      onClick={handleSendRfi}
                      disabled={rfiSending}
                    >
                      {rfiSending ? (
                        <>
                          <LoadingSpinner size={18} inline />
                          Sending...
                        </>
                      ) : (
                        <>
                          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                            <path d="M2 9l14-7-4 16-4-6-6-3z" fill="currentColor"/>
                          </svg>
                          Send Request
                        </>
                      )}
                    </button>
                    <button 
                      className="rfi-template-btn"
                      onClick={() => setShowTemplates(!showTemplates)}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M5 6h6M5 8h6M5 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      Use Template
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="rfi-footer">
              {rfiSent ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="6" stroke="#059669" strokeWidth="1.5"/>
                    <path d="M5 7l2 2 3-3" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span style={{ color: '#059669' }}>Request sent • Awaiting provider response</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M7 4v3l2 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span>Response typically received within 24-48 hours</span>
                </>
              )}
            </div>
          </motion.aside>
        )}

        {/* PDF Viewer Panel */}
        <AnimatePresence>
          {showPdf && (
            <motion.aside 
              className="pdf-panel-new"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ duration: 0.3 }}
            >
              {fileUrl ? (
                <PdfViewer 
                  fileUrl={fileUrl}
                  highlightPage={evidenceActive ? evidencePage : null}
                  onClose={() => {
                    setShowPdf(false)
                    setEvidenceActive(false)
                  }}
                />
              ) : (
                <div className="pdf-placeholder-new">
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <rect x="8" y="4" width="32" height="40" rx="4" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2"/>
                    <path d="M16 16h16M16 24h16M16 32h10" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <p>Document preview not available</p>
                  <button className="action-btn secondary" onClick={() => setShowPdf(false)}>
                    Close
                  </button>
                </div>
              )}
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default CaseDetail
