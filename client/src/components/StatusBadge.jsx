import React from 'react'
import clsx from 'clsx'

const StatusBadge = ({ status }) => {
  const normalized = (status || '').toUpperCase()
  const isApproved = normalized === 'APPROVED'
  const isDenied = normalized === 'DENIED'

  return (
    <span
      className={clsx('status-badge', {
        approved: isApproved,
        denied: isDenied,
      })}
    >
      {normalized || 'UNKNOWN'}
    </span>
  )
}

export default StatusBadge
