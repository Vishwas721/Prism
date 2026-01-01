import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'
import FileUpload from './components/FileUpload'
import StatusBadge from './components/StatusBadge'
import JsonViewer from './components/JsonViewer'
import PolicySelector from './components/PolicySelector'

const scanningSteps = [
  'Extracting OCR...',
  'Checking Medical Entities...',
  'Evaluating Policy...',
]

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const App = () => {
  const [policy, setPolicy] = useState('')
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('IDLE')
  const [decisionStatus, setDecisionStatus] = useState('UNKNOWN')
  const [message, setMessage] = useState('Waiting for clinical data...')
  const [entities, setEntities] = useState([])
  const [fhir, setFhir] = useState({})
  const [reasoning, setReasoning] = useState('')
  const [evidence, setEvidence] = useState('')
  const [rfiDraft, setRfiDraft] = useState('')
  const [toast, setToast] = useState('')
  const [scanIndex, setScanIndex] = useState(0)

  useEffect(() => {
    if (status !== 'LOADING') return
    const interval = setInterval(() => {
      setScanIndex((prev) => (prev + 1) % scanningSteps.length)
    }, 600)
    return () => clearInterval(interval)
  }, [status])

  const onFileSelected = (selectedFile) => {
    setFile(selectedFile)
  }

  const handleSubmit = async () => {
    if (!file) {
      setMessage('Please attach a PDF before submitting.')
      return
    }

    setStatus('LOADING')
    setDecisionStatus('UNKNOWN')
    setMessage(scanningSteps[0])
    setReasoning('')
    setEntities([])
    setFhir({})
    setEvidence('')
    setRfiDraft('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('policy_id', policy)

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

    try {
      const [response] = await Promise.all([
        axios.post(`${API_URL}/api/analyze`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        }),
        delay(1500),
      ])

      const data = response.data
      setStatus('SUCCESS')
      setDecisionStatus((data.status || 'UNKNOWN').toUpperCase())
      setMessage('Decision ready')
      setReasoning(data.reasoning || '')
      setEntities(data.entities_detected || [])
      setFhir(data.fhir_json || {})
      setEvidence(data.evidence_quote || '')
      setRfiDraft(data.rfi_draft || '')
    } catch (error) {
      console.error(error)
      setStatus('ERROR')
      setMessage('Failed to analyze document')
    }
  }

  const handleSendRfi = () => {
    setToast('Sent!')
    setTimeout(() => setToast(''), 1500)
  }

  const statusContent = useMemo(() => {
    if (status === 'LOADING') {
      return (
        <div className="scanner">
          <AnimatePresence mode="wait">
            <motion.div
              key={scanIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="scan-step"
            >
              {scanningSteps[scanIndex]}
            </motion.div>
          </AnimatePresence>
          <div className="scan-bar" />
        </div>
      )
    }

    if (status === 'SUCCESS') {
      return (
        <div className="result-card">
          <div className="result-header">
            <StatusBadge status={decisionStatus} />
            <p className="result-label">AI Decision Engine</p>
          </div>
          <p className="reasoning">{reasoning || 'No reasoning returned.'}</p>
          {evidence && (
            <div className="evidence-block">
              <div className="evidence-label">🔎 Source Evidence:</div>
              <div className="evidence-text">“{evidence}”</div>
            </div>
          )}
          {decisionStatus === 'ACTION_REQUIRED' && (
            <div className="section">
              <h4 className="section-title">Suggested RFI Draft</h4>
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
                {toast && <span className="pill" style={{ background: '#ecfeff', color: '#0ea5e9' }}>{toast}</span>}
              </div>
            </div>
          )}
          <div className="section">
            <h4 className="section-title">Entities Detected</h4>
            {entities.length ? (
              <ul className="pill-list">
                {entities.map((item, idx) => (
                  <li key={idx} className="pill">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">None detected.</p>
            )}
          </div>
          <div className="section">
            <h4 className="section-title">FHIR JSON</h4>
            <JsonViewer data={fhir} />
          </div>
        </div>
      )
    }

    if (status === 'ERROR') {
      return <p className="error-text">{message}</p>
    }

    return <p className="muted">{message}</p>
  }, [status, scanIndex, reasoning, entities, fhir, message, decisionStatus, rfiDraft, toast, evidence])

  return (
    <div className="page">
      <header className="header">
        <div className="brand">
          <span className="logo">⚕️</span>
          <div>
            <p className="title">PRISM</p>
            <p className="subtitle">Medical Review Dashboard</p>
          </div>
        </div>
        <button className="primary" onClick={handleSubmit} disabled={status === 'LOADING'}>
          Run Analysis
        </button>
      </header>

      <main className="grid">
        <section className="card">
          <div className="card-header">
            <h3>Input Context</h3>
            <p className="muted">Upload the patient PDF and select a policy.</p>
          </div>
          <div className="field">
            <label htmlFor="policy">Select Policy</label>
            <PolicySelector
              value={policy}
              onChange={setPolicy}
              disabled={status === 'LOADING'}
            />
          </div>
          <FileUpload onFileSelected={onFileSelected} disabled={status === 'LOADING'} />
          {file && <p className="muted">Selected: {file.name}</p>}
        </section>

        <section className="card">
          <div className="card-header">
            <h3>AI Decision Engine</h3>
            <p className="muted">Orchestrates OCR → Entities → Policy Eval.</p>
          </div>
          {statusContent}
        </section>
      </main>
    </div>
  )
}

export default App
