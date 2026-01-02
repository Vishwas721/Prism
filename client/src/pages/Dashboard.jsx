import React, { useEffect, useState, useMemo } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table'
import FileUpload from '../components/FileUpload'
import PolicySelector from '../components/PolicySelector'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Pulse indicator for urgent cases
const PulseIndicator = ({ color = '#ef4444' }) => (
  <motion.span
    animate={{ opacity: [1, 0.4, 1] }}
    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
    style={{
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: '50%',
      backgroundColor: color,
      marginRight: 8,
    }}
  />
)

const Dashboard = () => {
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState([])
  
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
    data: patients,
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

  if (loading) {
    return (
      <div className="page">
        <p className="muted">Loading cases...</p>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
        <div className="brand">
          <div>
            <p className="title" style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>
              Prism <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>/</span> Nurse Queue
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="table-search">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search cases..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="search-input"
            />
          </div>
          <button className="primary" onClick={() => setShowModal(true)} style={{ borderRadius: 20, padding: '10px 20px' }}>
            New Case
          </button>
        </div>
      </header>

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
                  <td colSpan={columns.length} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                    {globalFilter ? 'No cases match your search' : 'No cases found'}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map(row => (
                  <motion.tr
                    key={row.id}
                    onClick={() => navigate(`/case/${row.original.id}`)}
                    className="clickable-row"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    whileHover={{ 
                      scale: 1.005, 
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      transition: { duration: 0.15 }
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
