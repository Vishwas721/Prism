import React from 'react'
import { motion } from 'framer-motion'

const LoadingSpinner = ({ size = 40, text = 'Loading...', inline = false }) => {
  const spinner = (
    <motion.div
      className="loading-spinner"
      style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
    >
      <svg viewBox="0 0 50 50" fill="none" width={size} height={size}>
        <circle
          cx="25"
          cy="25"
          r="20"
          stroke={inline ? 'rgba(255,255,255,0.3)' : '#e2e8f0'}
          strokeWidth="4"
          fill="none"
        />
        <circle
          cx="25"
          cy="25"
          r="20"
          stroke={inline ? 'white' : 'var(--action-primary)'}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="80 100"
        />
      </svg>
    </motion.div>
  )

  if (inline || !text) {
    return spinner
  }

  return (
    <div className="loading-container">
      {spinner}
      {text && <p className="loading-text">{text}</p>}
    </div>
  )
}

export const SkeletonRow = () => (
  <tr className="skeleton-row">
    {[...Array(6)].map((_, i) => (
      <td key={i}>
        <div className="skeleton-cell" style={{ width: `${60 + Math.random() * 40}%` }} />
      </td>
    ))}
  </tr>
)

export const SkeletonCard = () => (
  <div className="skeleton-card">
    <div className="skeleton-header">
      <div className="skeleton-title" />
      <div className="skeleton-badge" />
    </div>
    <div className="skeleton-body">
      <div className="skeleton-line" style={{ width: '100%' }} />
      <div className="skeleton-line" style={{ width: '85%' }} />
      <div className="skeleton-line" style={{ width: '70%' }} />
    </div>
  </div>
)

export default LoadingSpinner
