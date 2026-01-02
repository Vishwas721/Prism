import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import JsonViewer from '../components/JsonViewer'
import PdfViewer from '../components/PdfViewer'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const CaseDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [patient, setPatient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [rfiDraft, setRfiDraft] = useState('')
  const [toast, setToast] = useState('')
  const [showFhir, setShowFhir] = useState(false)
  const [showPdf, setShowPdf] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [evidenceActive, setEvidenceActive] = useState(false)
  const [evidencePage, setEvidencePage] = useState(1)

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

  const handleSendRfi = () => {
    setToast('Sent!')
    setTimeout(() => setToast(''), 1500)
  }

  const handleExport = async () => {
    setIsExporting(true)
    
    // Simulate processing
    await new Promise((resolve) => setTimeout(resolve, 1500))
    
    if (!patient || !result?.fhir_json) {
      alert('No FHIR data available for export')
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
    
    // Show success message
    setToast('✅ FHIR Resource exported successfully!')
    setTimeout(() => setToast(''), 3000)
    
    setIsExporting(false)
  }

  if (loading) {
    return (
      <div className="page">
        <p className="muted">Loading case...</p>
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="page">
        <p className="error-text">Case not found</p>
        <button className="primary" onClick={() => navigate('/')}>
          Back to Dashboard
        </button>
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
    if (normalized === 'APPROVED') return { bg: '#059669', icon: '✓' }
    if (normalized === 'DENIED') return { bg: '#dc2626', icon: '✕' }
    if (normalized === 'ACTION_REQUIRED') return { bg: '#d97706', icon: '!' }
    return { bg: '#64748b', icon: '?' }
  }

  const statusStyle = getStatusStyle(patient.status)

  return (
    <div className="page" style={{ padding: '24px 40px' }}>
      <button 
        className="back-link" 
        onClick={() => navigate('/')}
        style={{ 
          background: 'none', 
          border: 'none', 
          color: 'var(--text-secondary)', 
          cursor: 'pointer',
          fontSize: 13,
          marginBottom: 16,
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 4
        }}
      >
        ← Back to Queue
      </button>

      <main
        style={{
          display: 'grid',
          gridTemplateColumns: showPdf ? '1fr 1fr' : '1fr',
          gap: '24px',
          alignItems: 'flex-start',
        }}
      >
        {/* Left Panel - Case Info */}
        <section className="detail-card">
          {/* Header with name and status */}
          <div className="detail-header">
            <div>
              <h1 className="detail-title">{patient.patient_name}</h1>
              <p className="detail-subtitle">{patient.policy_name?.split(' - ').pop() || patient.policy_name}</p>
            </div>
            <div 
              className="status-pill"
              style={{ 
                background: statusStyle.bg,
                color: 'white',
                padding: '8px 16px',
                borderRadius: 20,
                fontWeight: 600,
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span style={{ 
                width: 18, 
                height: 18, 
                borderRadius: '50%', 
                border: '2px solid white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700
              }}>
                {statusStyle.icon}
              </span>
              {patient.status === 'ACTION_REQUIRED' ? 'ACTION REQUIRED' : patient.status}
            </div>
          </div>

          {/* Pending state */}
          {patient.status === 'PENDING' && (
            <div style={{ marginTop: 24 }}>
              <p className="muted" style={{ marginBottom: 16 }}>This case has not been analyzed yet.</p>
              <button
                className="primary"
                onClick={handleAnalyze}
                disabled={analyzing}
                style={{ width: '100%', padding: '14px 20px', fontSize: 15 }}
              >
                {analyzing ? '⏳ Analyzing Document...' : '🔍 Run AI Analysis'}
              </button>
            </div>
          )}

          {/* Analysis Results */}
          {result && (
            <div className="analysis-results">
              {/* AI Summary - The key sentence explaining the decision */}
              {(result.summary || result.reasoning) && (
                <div className="ai-summary-box">
                  <p className="ai-summary-text">{result.summary || result.reasoning}</p>
                </div>
              )}

              {/* Dynamic Checklist Items based on AI analysis */}
              <div className="checklist">
                {/* Clinical Criteria Check - Dynamic based on result */}
                <div className="checklist-item">
                  <span className={`check-icon ${result.criteria_met ? 'approved' : 'failed'}`}>
                    {result.criteria_met ? '✓' : '✕'}
                  </span>
                  <div className="check-content">
                    <span className="check-title">Clinical Criteria</span>
                    <span className="check-subtitle">
                      {result.criteria_met 
                        ? 'All policy criteria satisfied' 
                        : result.missing_criteria || 'Some criteria not met'}
                    </span>
                  </div>
                </div>
                
                {/* Documentation Check */}
                <div className="checklist-item">
                  <span className={`check-icon ${result.documentation_complete ? 'approved' : result.documentation_complete === false ? 'failed' : 'pending'}`}>
                    {result.documentation_complete ? '✓' : result.documentation_complete === false ? '✕' : '!'}
                  </span>
                  <div className="check-content">
                    <span className="check-title">Documentation Review</span>
                    <span className="check-subtitle">
                      {result.documentation_complete 
                        ? 'All required documents provided' 
                        : result.missing_documentation || 'Missing required documentation'}
                    </span>
                  </div>
                </div>

                {/* Policy Match Check */}
                <div className="checklist-item">
                  <span className={`check-icon ${result.policy_match ? 'approved' : 'pending'}`}>
                    {result.policy_match ? '✓' : '?'}
                  </span>
                  <div className="check-content">
                    <span className="check-title">Policy Guideline Match</span>
                    <span className="check-subtitle">
                      {result.policy_match 
                        ? 'Treatment aligns with policy guidelines' 
                        : 'Policy alignment under review'}
                    </span>
                  </div>
                </div>

                {/* Prior Auth Check - if applicable */}
                {result.prior_auth_status !== undefined && (
                  <div className="checklist-item">
                    <span className={`check-icon ${result.prior_auth_status === 'active' ? 'approved' : 'pending'}`}>
                      {result.prior_auth_status === 'active' ? '✓' : '!'}
                    </span>
                    <div className="check-content">
                      <span className="check-title">Prior Authorization</span>
                      <span className="check-subtitle">
                        {result.prior_auth_status === 'active' 
                          ? 'Active authorization confirmed' 
                          : 'Authorization status: ' + result.prior_auth_status}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Evidence Quote Box - Interactive Card */}
              {result.evidence_quote && (
                <motion.div 
                  className={`evidence-card ${evidenceActive ? 'evidence-active' : ''}`}
                  whileHover={{ scale: 1.01 }}
                  onClick={handleEvidenceClick}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="evidence-header">
                    <strong>📄 Found Evidence</strong>
                    {evidenceActive && (
                      <span className="evidence-linked-badge">
                        🔗 Linked to Page {evidencePage}
                      </span>
                    )}
                  </div>
                  <motion.p 
                    className="evidence-quote"
                    animate={evidenceActive ? { 
                      backgroundColor: ['#fef3c7', '#fefce8', '#fef3c7'] 
                    } : {}}
                    transition={{ duration: 2, repeat: evidenceActive ? Infinity : 0 }}
                  >
                    "{result.evidence_quote}"
                  </motion.p>
                  <div className="evidence-actions">
                    <button 
                      className={`verify-btn ${evidenceActive ? 'verify-btn-active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEvidenceClick()
                      }}
                    >
                      {evidenceActive ? '✓ Viewing Source' : 'Verify Source 🔍'}
                    </button>
                    {evidenceActive && (
                      <button 
                        className="unlink-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEvidenceActive(false)
                        }}
                      >
                        Unlink
                      </button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Medical Entities */}
              {result.entities_detected?.length > 0 && (
                <div className="entities-section">
                  <div className="checklist-item" style={{ marginBottom: 8 }}>
                    <span className="check-icon" style={{ background: '#e2e8f0', color: '#64748b' }}>📋</span>
                    <div className="check-content">
                      <span className="check-title">Extracted Medical Entities</span>
                    </div>
                  </div>
                  <div className="entity-tags">
                    {result.entities_detected.map((entity, idx) => (
                      <span key={idx} className="entity-tag">{entity}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Required - RFI Section */}
              {result.status === 'ACTION_REQUIRED' && (
                <div className="rfi-section">
                  <div className="checklist-item" style={{ marginBottom: 12 }}>
                    <span className="check-icon pending">!</span>
                    <div className="check-content">
                      <span className="check-title">Additional Information Required</span>
                      <span className="check-subtitle">Send request to provider</span>
                    </div>
                  </div>
                  <textarea
                    className="rfi-textarea"
                    value={rfiDraft}
                    onChange={(e) => setRfiDraft(e.target.value)}
                    rows={4}
                    placeholder="Draft your request for information..."
                  />
                </div>
              )}

              {/* FHIR JSON Viewer */}
              {showFhir && (
                <div style={{ marginTop: 16 }}>
                  <JsonViewer data={result.fhir_json} />
                </div>
              )}
            </div>
          )}

          {/* Bottom Action Buttons */}
          {result && (
            <div className="action-buttons">
              <button
                className="btn-primary-large"
                onClick={result.status === 'APPROVED' ? handleExport : handleSendRfi}
                disabled={isExporting}
              >
                {isExporting ? (
                  '⏳ Generating...'
                ) : result.status === 'APPROVED' ? (
                  'Export FHIR (JSON)'
                ) : (
                  'Request More Info'
                )}
              </button>
              
              <button
                className="btn-secondary-large"
                onClick={() => setShowFhir(!showFhir)}
              >
                {showFhir ? 'Hide FHIR' : 'View FHIR JSON'}
              </button>

              <button
                className="btn-secondary-large"
                onClick={() => setShowPdf(!showPdf)}
              >
                {showPdf ? 'Hide Document' : 'View Document'}
              </button>

              {toast && (
                <div className="toast-message">{toast}</div>
              )}
            </div>
          )}
        </section>

        {/* Right Panel - PDF Viewer */}
        <AnimatePresence>
          {showPdf && (
            <motion.section 
              className="pdf-panel"
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
                <div className="pdf-placeholder">
                  <p>Document preview not available</p>
                  <button 
                    className="btn-secondary"
                    onClick={() => setShowPdf(false)}
                  >
                    Close
                  </button>
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}

export default CaseDetail
