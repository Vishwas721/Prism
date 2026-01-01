import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import FileUpload from '../components/FileUpload'
import PolicySelector from '../components/PolicySelector'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const Dashboard = () => {
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  // New case form state
  const [patientName, setPatientName] = useState('')
  const [policyId, setPolicyId] = useState('')
  const [file, setFile] = useState(null)
  
  const navigate = useNavigate()

  useEffect(() => {
    fetchPatients()
    // Refresh SLA countdown every minute
    const interval = setInterval(fetchPatients, 60000)
    return () => clearInterval(interval)
  }, [])

  const fetchPatients = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/patients`)
      setPatients(response.data)
    } catch (error) {
      console.error('Failed to load patients:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUploadCase = async () => {
    if (!patientName || !policyId || !file) {
      alert('Please fill all fields and select a file')
      return
    }

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('patient_name', patientName)
    formData.append('policy_id', policyId)

    try {
      await axios.post(`${API_URL}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      
      // Reset form and close modal
      setPatientName('')
      setPolicyId('')
      setFile(null)
      setShowModal(false)
      
      // Refresh patient list
      fetchPatients()
    } catch (error) {
      console.error('Failed to upload case:', error)
      alert('Failed to upload case')
    } finally {
      setUploading(false)
    }
  }

  const getStatusBadgeClass = (status) => {
    const normalized = (status || '').toUpperCase()
    if (normalized === 'APPROVED') return 'badge-approved'
    if (normalized === 'DENIED') return 'badge-denied'
    if (normalized === 'ACTION_REQUIRED') return 'badge-action'
    return 'badge-pending'
  }

  const getStatusLabel = (status) => {
    const normalized = (status || '').toUpperCase()
    if (normalized === 'ACTION_REQUIRED') return 'NEEDS INFO'
    return normalized
  }

  const getSlaClass = (hours) => {
    if (hours <= 24) return 'sla-urgent'
    if (hours <= 48) return 'sla-warning'
    return 'sla-normal'
  }

  const formatSla = (hours) => {
    if (hours < 0) return 'OVERDUE'
    const h = Math.floor(hours)
    const m = Math.floor((hours - h) * 60)
    return `${h}h ${m}m`
  }

  if (loading) {
    return (
      <div className="page">
        <p className="muted">Loading cases...</p>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="header">
        <div className="brand">
          <span className="logo">⚕️</span>
          <div>
            <p className="title">PRISM - Nurse Queue</p>
            <p className="subtitle">Prior Authorization Dashboard</p>
          </div>
        </div>
        <button className="primary" onClick={() => setShowModal(true)}>
          + New Case
        </button>
      </header>

      <main className="dashboard-main">
        <div className="card">
          <div className="card-header">
            <h3>Patient Cases ({patients.length})</h3>
            <p className="muted">Click a row to review</p>
          </div>

          <div className="table-container">
            <table className="patient-table">
              <thead>
                <tr>
                  <th>Case ID</th>
                  <th>Patient Name</th>
                  <th>Policy</th>
                  <th>Received</th>
                  <th>SLA</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((patient) => (
                  <tr
                    key={patient.id}
                    onClick={() => navigate(`/case/${patient.id}`)}
                    className="clickable-row"
                  >
                    <td className="case-id">{patient.id}</td>
                    <td className="patient-name">{patient.patient_name}</td>
                    <td className="policy-name">{patient.policy_name}</td>
                    <td className="received-date">
                      {new Date(patient.received_date).toLocaleString()}
                    </td>
                    <td className={getSlaClass(patient.sla_remaining_hours)}>
                      {formatSla(patient.sla_remaining_hours)}
                    </td>
                    <td>
                      <span className={`table-badge ${getStatusBadgeClass(patient.status)}`}>
                        {getStatusLabel(patient.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* New Case Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Upload New Case</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ✕
              </button>
            </div>
            
            <div className="modal-body">
              <div className="field">
                <label>Patient Name</label>
                <input
                  type="text"
                  className="input"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="e.g., John Doe"
                />
              </div>

              <div className="field">
                <label>Select Policy</label>
                <PolicySelector value={policyId} onChange={setPolicyId} />
              </div>

              <div className="field">
                <label>Upload Patient Document</label>
                <FileUpload onFileSelected={setFile} disabled={uploading} />
                {file && <p className="muted">Selected: {file.name}</p>}
              </div>
            </div>

            <div className="modal-footer">
              <button className="secondary" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button
                className="primary"
                onClick={handleUploadCase}
                disabled={uploading || !patientName || !policyId || !file}
              >
                {uploading ? 'Uploading...' : 'Upload Case'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
