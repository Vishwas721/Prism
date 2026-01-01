import React, { useEffect, useState } from 'react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const PolicySelector = ({ value, onChange, disabled }) => {
  const [policies, setPolicies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchPolicies = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/policies`)
        setPolicies(response.data)
        // Auto-select first policy if none selected
        if (!value && response.data.length > 0) {
          onChange(response.data[0].id)
        }
      } catch (err) {
        console.error('Failed to load policies:', err)
        setError('Failed to load policies')
      } finally {
        setLoading(false)
      }
    }

    fetchPolicies()
  }, [])

  if (loading) {
    return (
      <select className="select" disabled>
        <option>Loading policies...</option>
      </select>
    )
  }

  if (error) {
    return (
      <select className="select" disabled>
        <option>{error}</option>
      </select>
    )
  }

  return (
    <select
      id="policy"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="select"
      disabled={disabled}
    >
      {policies.map((policy) => (
        <option key={policy.id} value={policy.id}>
          {policy.name}
        </option>
      ))}
    </select>
  )
}

export default PolicySelector
