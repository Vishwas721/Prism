import React, { useEffect, useState, useMemo } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table'
import FileUpload from '../components/FileUpload'
import PolicySelector from '../components/PolicySelector'
import LoadingSpinner, { SkeletonRow } from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import { useToast } from '../components/Toast'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const PROVIDERS = [
  { id: 'dr-chen', name: 'Dr. Sarah Chen', status: 'GOLD_CARD', approval_rate: 98 },
  { id: 'dr-smith', name: 'Dr. John Smith', status: 'STANDARD', approval_rate: 75 },
]

// Pulse indicator for urgent cases
const PulseIndicator = ({ color = '#ef4444' }) => (
  <motion.span
    animate={{ opacity: [1, 0.4, 1] }}
    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
    className="pulse-dot"
    style={{ backgroundColor: color }}
  />
)

// Status filter tabs
const StatusFilter = ({ active, onChange, counts }) => {
  const tabs = [
    { key: 'all', label: 'All Cases', count: counts.all, className: 'tab-all' },
    { key: 'pending', label: 'Pending', count: counts.pending, className: 'tab-pending' },
    { key: 'action', label: 'Action Required', count: counts.action, className: 'tab-action' },
    { key: 'approved', label: 'Approved', count: counts.approved, className: 'tab-approved' },
  ]

  return (
    <div className="status-filter-tabs">
      {tabs.map(tab => (
        <button
          key={tab.key}
          className={`status-filter-tab ${tab.className} ${active === tab.key ? 'active' : ''}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          <span className="tab-count">{tab.count}</span>
        </button>
      ))}
    </div>
  )
}

const Dashboard = () => {
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [globalFilter, setGlobalFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sorting, setSorting] = useState([{ id: 'sla_remaining_hours', desc: false }])
  
  // New case form state
  const [patientName, setPatientName] = useState('')
  const [policyId, setPolicyId] = useState('')
  const [providerId, setProviderId] = useState('')
  const [slaHours, setSlaHours] = useState('72')
  const [file, setFile] = useState(null)
  const [formErrors, setFormErrors] = useState({})
  
  const navigate = useNavigate()
  const toast = useToast()

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
      toast.error('Failed to load cases. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }

  const validateForm = () => {
    const errors = {}
    if (!policyId) errors.policyId = 'Please select a policy'
    if (!file) errors.file = 'Please upload a document'
    if (!slaHours || parseInt(slaHours) <= 0) errors.slaHours = 'SLA hours must be greater than 0'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleUploadCase = async () => {
    if (!validateForm()) {
      toast.warning('Please fill in all required fields')
      return
    }

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    if (patientName.trim()) {
      formData.append('patient_name', patientName.trim())
    }
    formData.append('policy_id', policyId)
    formData.append('sla_hours', slaHours)
    if (providerId) {
      formData.append('provider_id', providerId)
    }
    if (providerId) {
      formData.append('provider_id', providerId)
    }

    try {
      const response = await axios.post(`${API_URL}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      
      // Reset form and close modal
      setPatientName('')
      setPolicyId('')
      setProviderId('')
      setSlaHours('72')
      setFile(null)
      setFormErrors({})
      setShowModal(false)
      
      // Refresh patient list
      fetchPatients()
      const resolvedName = response?.data?.patient_name || patientName || 'new case'
      toast.success(`Case created for ${resolvedName}`)
    } catch (error) {
      console.error('Failed to upload case:', error)
      toast.error('Failed to upload case. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setPatientName('')
    setPolicyId('')
    setProviderId('')
    setSlaHours('72')
    setFile(null)
    setFormErrors({})
  }

  // Computed counts for status filter
  const statusCounts = useMemo(() => ({
    all: patients.length,
    pending: patients.filter(p => p.status === 'PENDING').length,
    action: patients.filter(p => p.status === 'ACTION_REQUIRED').length,
    approved: patients.filter(p => p.status === 'APPROVED').length,
  }), [patients])

  // Filter patients by status
  const filteredPatients = useMemo(() => {
    if (statusFilter === 'all') return patients
    const statusMap = {
      pending: 'PENDING',
      action: 'ACTION_REQUIRED',
      approved: 'APPROVED',
    }
    return patients.filter(p => p.status === statusMap[statusFilter])
  }, [patients, statusFilter])

  const getStatusBadgeClass = (status) => {
    const normalized = (status || '').toUpperCase()
    if (normalized === 'AUTO_APPROVED') return 'badge-gold-card'
    if (normalized === 'APPROVED') return 'badge-approved'
    if (normalized === 'DENIED') return 'badge-denied'
    if (normalized === 'ACTION_REQUIRED') return 'badge-action'
    return 'badge-pending'
  }

  const getStatusLabel = (status) => {
    const normalized = (status || '').toUpperCase()
    if (normalized === 'AUTO_APPROVED') return 'Gold Card'
    if (normalized === 'ACTION_REQUIRED') return 'Action Required'
    if (normalized === 'APPROVED') return 'Approved'
    if (normalized === 'DENIED') return 'Denied'
    if (normalized === 'PENDING') return 'Pending'
    return normalized
  }

  const getSlaClass = (hours) => {
    if (hours < 0) return 'sla-overdue'
    if (hours <= 4) return 'sla-critical'
    if (hours <= 24) return 'sla-urgent'
    if (hours <= 48) return 'sla-warning'
    return 'sla-normal'
  }

  const formatSla = (hours) => {
    if (hours < 0) {
      const overdue = Math.abs(hours)
      return `OVERDUE (${Math.floor(overdue)}h)`
    }
    const h = Math.floor(hours)
    const m = Math.floor((hours - h) * 60)
    return `${h}h remaining`
  }

  // Calculate SLA progress percentage (72h max SLA)
  const getSlaProgress = (hours, maxSla = 72) => {
    if (hours < 0) return 100
    return Math.max(0, Math.min(100, ((maxSla - hours) / maxSla) * 100))
  }

  const getSlaBarColor = (hours) => {
    if (hours < 0) return '#dc2626' // Red for overdue
    if (hours <= 4) return '#dc2626' // Red for critical
    if (hours <= 24) return '#f59e0b' // Amber for urgent
    if (hours <= 48) return '#f59e0b' // Amber for warning
    return '#3b82f6' // Blue for normal
  }

  // Define table columns
  const columns = useMemo(() => [
    {
      accessorKey: 'id',
      header: 'Case ID',
      cell: ({ getValue }) => <span className="case-id">{getValue()}</span>,
      size: 100,
    },
    {
      accessorKey: 'patient_name',
      header: 'Patient',
      cell: ({ getValue }) => <span className="patient-name">{getValue()}</span>,
    },
    {
      accessorFn: (row) => row.policy_name?.split(' - ')[0] || 'Policy',
      id: 'policy_type',
      header: 'Policy Type',
      cell: ({ getValue }) => <span className="policy-name">{getValue()}</span>,
    },
    {
      accessorKey: 'received_date',
      header: ({ column }) => (
        <button
          className="table-header-btn"
          onClick={() => column.toggleSorting()}
        >
          Received
          {column.getIsSorted() === 'asc' ? ' ↑' : column.getIsSorted() === 'desc' ? ' ↓' : ''}
        </button>
      ),
      cell: ({ getValue }) => (
        <span className="received-date">
          {new Date(getValue()).toLocaleDateString('en-GB', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric' 
          })}
        </span>
      ),
      sortingFn: 'datetime',
    },
    {
      accessorKey: 'sla_remaining_hours',
      header: ({ column }) => (
        <button
          className="table-header-btn"
          onClick={() => column.toggleSorting()}
        >
          SLA Status
          {column.getIsSorted() === 'asc' ? ' ↑' : column.getIsSorted() === 'desc' ? ' ↓' : ''}
        </button>
      ),
      cell: ({ row }) => {
        const hours = row.original.sla_remaining_hours
        const maxSla = row.original.sla_hours || 72
        const isUrgent = hours <= 4 || hours < 0
        
        return (
          <div className="sla-indicator">
            <div 
              className={`sla-bar ${isUrgent ? 'sla-bar-critical' : ''}`}
              style={{
                '--sla-color': getSlaBarColor(hours),
                '--sla-progress': `${getSlaProgress(hours, maxSla)}%`
              }}
            >
              <div className="sla-bar-fill"></div>
            </div>
            <span className={getSlaClass(hours)} style={{ display: 'flex', alignItems: 'center' }}>
              {isUrgent && <PulseIndicator color={getSlaBarColor(hours)} />}
              {formatSla(hours)}
            </span>
          </div>
        )
      },
      sortingFn: 'basic',
    },
    {
      accessorKey: 'status',
      header: 'AI Assessment',
      cell: ({ getValue }) => (
        <span className={`assessment-badge ${getStatusBadgeClass(getValue())}`}>
          {getStatusLabel(getValue())}
        </span>
      ),
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue) return true
        const status = row.getValue(columnId)?.toUpperCase()
        return status?.includes(filterValue.toUpperCase())
      },
    },
  ], [])

  // Create table instance
  const table = useReactTable({
    data: filteredPatients,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: 'includesString',
  })

  // Full page loading state
  if (loading) {
    return (
      <div className="page">
        <header className="header">
          <div className="brand">
            <h1 className="title" style={{ fontSize: 22, fontWeight: 700 }}>
              Prism <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}></span> 
            </h1>
          </div>
        </header>
        <main className="dashboard-main">
          <div className="table-container">
            <table className="patient-table">
              <thead>
                <tr>
                  <th>Case ID</th>
                  <th>Patient</th>
                  <th>Policy Type</th>
                  <th>Received</th>
                  <th>SLA Status</th>
                  <th>AI Assessment</th>
                </tr>
              </thead>
              <tbody>
                {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="page">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <h1 className="dashboard-title">
            <span className="title-prism">Prism</span>
            <span className="title-divider"></span>
            <span className="title-section"></span>
          </h1>
          <p className="dashboard-subtitle">
            {patients.length} cases • {statusCounts.action} require attention
          </p>
        </div>
        <div className="header-right">
          <div className="table-search">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="search-input"
            />
            {globalFilter && (
              <button 
                className="search-clear" 
                onClick={() => setGlobalFilter('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          <button className="btn-new-case" onClick={() => setShowModal(true)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            New Case
          </button>
        </div>
      </header>

      {/* Status Filter Tabs */}
      <StatusFilter 
        active={statusFilter} 
        onChange={setStatusFilter} 
        counts={statusCounts}
      />

      <main className="dashboard-main">
        <div className="table-container">
          <table className="patient-table">
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th key={header.id} style={{ width: header.getSize() }}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())
                      }
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length}>
                    <EmptyState
                      icon={globalFilter ? 'search' : 'folder'}
                      title={globalFilter ? 'No matching cases' : 'No cases yet'}
                      description={
                        globalFilter 
                          ? `No cases match "${globalFilter}". Try a different search.`
                          : 'Upload your first patient case to get started with AI-powered analysis.'
                      }
                      action={
                        !globalFilter && (
                          <button className="btn-new-case" onClick={() => setShowModal(true)}>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                            Create First Case
                          </button>
                        )
                      }
                    />
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row, index) => (
                  <motion.tr
                    key={row.id}
                    onClick={() => navigate(`/case/${row.original.id}`)}
                    className="clickable-row"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.03 }}
                    whileHover={{ 
                      backgroundColor: '#f8fafc',
                      transition: { duration: 0.1 }
                    }}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Quick Stats */}
        <div className="dashboard-stats">
          <div className="stat-card">
            <span className="stat-value">{patients.length}</span>
            <span className="stat-label">Total Cases</span>
          </div>
          <div className="stat-card urgent">
            <span className="stat-value">
              {patients.filter(p => p.sla_remaining_hours <= 4 && p.sla_remaining_hours >= 0).length}
            </span>
            <span className="stat-label">Critical SLA</span>
          </div>
          <div className="stat-card overdue">
            <span className="stat-value">
              {patients.filter(p => p.sla_remaining_hours < 0).length}
            </span>
            <span className="stat-label">Overdue</span>
          </div>
          <div className="stat-card approved">
            <span className="stat-value">
              {patients.filter(p => p.status === 'APPROVED').length}
            </span>
            <span className="stat-label">Approved</span>
          </div>
        </div>
      </main>

      {/* New Case Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div 
            className="modal-overlay" 
            onClick={closeModal}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div 
              className="modal-content" 
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="modal-header">
                <div>
                  <h3>Create New Case</h3>
                  <p className="modal-subtitle">Upload patient documentation for AI analysis</p>
                </div>
                <button className="modal-close" onClick={closeModal} aria-label="Close modal">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M5 5l10 10M15 5l-10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
              
              <div className="modal-body">
                <div className="field">
                  <label htmlFor="patientName">
                    Patient Name <span className="optional">(Optional – auto-extracted from document if left blank)</span>
                  </label>
                  <input
                    id="patientName"
                    type="text"
                    className="input"
                    value={patientName}
                    onChange={(e) => {
                      setPatientName(e.target.value)
                    }}
                    placeholder="Enter patient's full name (or leave blank)"
                    disabled={uploading}
                  />
                </div>

                <div className={`field ${formErrors.policyId ? 'field-error' : ''}`}>
                  <label htmlFor="policyId">
                    Insurance Policy <span className="required">*</span>
                  </label>
                  <PolicySelector 
                    value={policyId} 
                    onChange={(val) => {
                      setPolicyId(val)
                      if (formErrors.policyId) setFormErrors(prev => ({ ...prev, policyId: '' }))
                    }}
                    disabled={uploading}
                  />
                  {formErrors.policyId && (
                    <span className="field-error-text">{formErrors.policyId}</span>
                  )}
                </div>

                <div className="field">
                  <label htmlFor="providerId">
                    Ordering Provider <span className="optional">(Optional)</span>
                  </label>
                  <select
                    id="providerId"
                    className="input"
                    value={providerId}
                    onChange={(e) => setProviderId(e.target.value)}
                    disabled={uploading}
                  >
                    <option value="">-- Select a provider --</option>
                    {PROVIDERS.map(provider => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name} {provider.status === 'GOLD_CARD' ? '⭐ (Gold Card)' : ''}
                      </option>
                    ))}
                  </select>
                  {providerId && PROVIDERS.find(p => p.id === providerId)?.status === 'GOLD_CARD' && (
                    <div className="provider-info-badge">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="7" r="6" fill="#0EA5E9"/>
                        <path d="M7 4v3l2 1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      <span>⚡ Gold Card - Instant Approval</span>
                    </div>
                  )}
                </div>

                <div className={`field ${formErrors.slaHours ? 'field-error' : ''}`}>
                  <label htmlFor="slaHours">
                    SLA Time (hours) <span className="required">*</span>
                  </label>
                  <input
                    id="slaHours"
                    type="number"
                    className="input"
                    value={slaHours}
                    onChange={(e) => {
                      setSlaHours(e.target.value)
                      if (formErrors.slaHours) setFormErrors(prev => ({ ...prev, slaHours: '' }))
                    }}
                    placeholder="Enter SLA hours (e.g., 24, 48, 72)"
                    min="1"
                    disabled={uploading}
                  />
                  {formErrors.slaHours && (
                    <span className="field-error-text">{formErrors.slaHours}</span>
                  )}
                  <span className="optional">Standard authorization timeframe (default: 72 hours)</span>
                </div>

                <div className={`field ${formErrors.file ? 'field-error' : ''}`}>
                  <label>
                    Patient Document <span className="required">*</span>
                  </label>
                  <FileUpload 
                    onFileSelected={(f) => {
                      setFile(f)
                      if (formErrors.file) setFormErrors(prev => ({ ...prev, file: '' }))
                    }} 
                    disabled={uploading} 
                  />
                  {file && (
                    <div className="file-selected">
                      <div className="file-selected-info">
                        <span className="file-selected-icon">📄</span>
                        <div>
                          <div className="file-selected-name">{file.name}</div>
                          <div className="file-selected-size">{(file.size / 1024).toFixed(1)} KB</div>
                        </div>
                      </div>
                      <button 
                        className="file-remove" 
                        onClick={() => setFile(null)}
                        aria-label="Remove file"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  {formErrors.file && (
                    <span className="field-error-text">{formErrors.file}</span>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  className="btn-secondary" 
                  onClick={closeModal}
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={handleUploadCase}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <LoadingSpinner size={16} inline />
                      Uploading...
                    </>
                  ) : (
                    'Create Case'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Dashboard
