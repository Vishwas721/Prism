import React from 'react'
import { motion } from 'framer-motion'

const EmptyState = ({ 
  icon = 'folder', 
  title = 'No data found',
  description = 'There are no items to display.',
  action = null,
  type = 'default'
}) => {
  const icons = {
    folder: (
      <svg width="32" height="32" viewBox="0 0 64 64" fill="none">
        <rect x="8" y="16" width="48" height="36" rx="4" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2"/>
        <path d="M8 20a4 4 0 014-4h12l4 4h28a4 4 0 014 4v-4H8v0z" fill="#cbd5e1"/>
        <circle cx="32" cy="36" r="8" fill="#94a3b8"/>
        <path d="M32 32v8M28 36h8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    search: (
      <svg width="32" height="32" viewBox="0 0 64 64" fill="none">
        <circle cx="28" cy="28" r="16" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2"/>
        <path d="M40 40l12 12" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round"/>
        <path d="M28 22a6 6 0 00-6 6" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    document: (
      <svg width="32" height="32" viewBox="0 0 64 64" fill="none">
        <rect x="12" y="8" width="40" height="48" rx="4" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2"/>
        <path d="M20 24h24M20 32h24M20 40h16" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"/>
        <path d="M40 8v12h12" fill="#cbd5e1"/>
      </svg>
    ),
    error: (
      <svg width="32" height="32" viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="24" fill="#fee2e2" stroke="#fca5a5" strokeWidth="2"/>
        <path d="M32 20v16M32 42v2" stroke="#dc2626" strokeWidth="3" strokeLinecap="round"/>
      </svg>
    ),
  }

  return (
    <motion.div 
      className={`empty-state ${type}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="empty-state-icon">
        {icons[icon] || icons.folder}
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>
      {action && (
        typeof action === 'object' && action.label ? (
          <button className="empty-state-action" onClick={action.onClick}>
            {action.label}
          </button>
        ) : (
          action
        )
      )}
    </motion.div>
  )
}

export default EmptyState
