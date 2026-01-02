import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import StatusBadge from '../components/StatusBadge'
import JsonViewer from '../components/JsonViewer'

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
    } catch (error) {
      console.error('Failed to load patient:', error)
    } finally {
      setLoading(false)
    }
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

  return (
    <div className="page">
      <header className="header">
        <div className="brand">
          <button className="back-button" onClick={() => navigate('/')}>
            ← Back
          </button>
          <div>
            <p className="title">{patient.patient_name}</p>
            <p className="subtitle">{patient.id} • {patient.policy_name}</p>
          </div>
        </div>
        {patient.status === 'PENDING' && (
          <button
            className="primary"
            onClick={handleAnalyze}
            disabled={analyzing}
          >
            {analyzing ? 'Analyzing...' : 'Run Analysis'}
          </button>
        )}
      </header>

      <main
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          alignItems: 'flex-start',
        }}
      >
        <section className="card" style={{ height: 'calc(100vh - 180px)' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Patient Document</h3>
            {showPdf && <span className="muted" style={{ fontSize: '0.9rem' }}>{patient.file_path}</span>}
          </div>
          {showPdf && fileUrl ? (
            <iframe
              src={fileUrl}
              title="Patient Document"
              style={{ width: '100%', height: '100%', border: '1px solid #e5e7eb', borderRadius: '12px' }}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#6b7280',
                fontSize: '1.1rem',
                textAlign: 'center',
              }}
            >
              <p>👉 Click an evidence link below to verify the source document</p>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <h3 style={{ marginBottom: 4 }}>{patient.patient_name}</h3>
              <p className="muted" style={{ margin: 0 }}>{patient.policy_name}</p>
            </div>
            <StatusBadge status={patient.status} />
          </div>

          <div className="case-info" style={{ marginBottom: 12 }}>
            <div className="info-row">
              <span className="info-label">Case ID:</span>
              <span>{patient.id}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Received:</span>
              <span>{new Date(patient.received_date).toLocaleString()}</span>
            </div>
            <div className="info-row">
              <span className="info-label">SLA Remaining:</span>
              <span>{patient.sla_remaining_hours}h</span>
            </div>
          </div>

          {!result && (
            <p className="muted">
              {patient.status === 'PENDING'
                ? 'Click "Run Analysis" to process this case'
                : 'No analysis results available'}
            </p>
          )}

          {result && (
            <div className="result-card" style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
              <p className="reasoning" style={{ marginTop: 0 }}>{result.reasoning}</p>

              {result.evidence_quote && (
                <div
                  className="evidence-block"
                  style={{
                    marginTop: 12,
                    cursor: 'pointer',
                    padding: '12px',
                    backgroundColor: showPdf ? '#f0fdf4' : '#fef3c7',
                    border: `2px solid ${showPdf ? '#22c55e' : '#f59e0b'}`,
                    borderRadius: '8px',
                    transition: 'all 0.3s ease',
                  }}
                  onClick={() => setShowPdf(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setShowPdf(true)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="evidence-label">
                    🔎 {showPdf ? 'Evidence Quote (Verified)' : 'Evidence Quote - Click to Verify'}
                  </div>
                  <div className="evidence-text">“{result.evidence_quote}”</div>
                </div>
              )}

              {result.entities_detected?.length > 0 && (
                <div className="section" style={{ marginTop: 12 }}>
                  <h4 className="section-title">Entities</h4>
                  <ul className="pill-list">
                    {result.entities_detected.map((item, idx) => (
                      <li key={idx} className="pill">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="section" style={{ marginTop: 12 }}>
                <h4 className="section-title">Actions</h4>
                {result.status === 'APPROVED' && (
                  <button className="primary" onClick={() => setShowFhir((prev) => !prev)}>
                    {showFhir ? 'Hide FHIR JSON' : 'Generate FHIR JSON'}
                  </button>
                )}

                {result.status === 'ACTION_REQUIRED' && (
                  <div className="section" style={{ marginTop: 8 }}>
                    <h4 className="section-title">Smart RFI Email Draft</h4>
                    <textarea
                      className="textarea"
                      value={rfiDraft}
                      onChange={(e) => setRfiDraft(e.target.value)}
                      rows={6}
                    />
                    <div className="section" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button className="primary" onClick={handleSendRfi}>
                        Send Request to Provider
                      </button>
                      {toast && (
                        <span className="pill" style={{ background: '#ecfeff', color: '#0ea5e9' }}>
                          {toast}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {(showFhir || result.status !== 'APPROVED') && (
                <div className="section" style={{ marginTop: 12 }}>
                  <h4 className="section-title">FHIR JSON</h4>
                  <JsonViewer data={result.fhir_json} />
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default CaseDetail
