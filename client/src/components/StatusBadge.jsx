import React from 'react'
import clsx from 'clsx'

const StatusBadge = ({ status }) => {
  const statusKey = status ? status.toUpperCase() : 'UNKNOWN'

  const label = statusKey === 'ACTION_REQUIRED' ? 'NEEDS INFO' : statusKey

  return (
    <span
      className={clsx(
        'status-badge',
        statusKey === 'APPROVED' && 'approved',
        statusKey === 'DENIED' && 'denied',
        statusKey === 'ACTION_REQUIRED' && 'action-required'
      )}
      style={{ fontSize: '1.1rem', fontWeight: 700 }}
    >
      {label}
    </span>
  )
}

export default StatusBadge
