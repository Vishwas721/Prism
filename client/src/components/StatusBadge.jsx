import React from 'react'
import clsx from 'clsx'

const StatusBadge = ({ status }) => {
  const statusKey = status ? status.toUpperCase() : 'UNKNOWN'

  return (
    <span
      className={clsx('status-badge', statusKey === 'APPROVED' && 'approved', statusKey === 'DENIED' && 'denied')}
      style={{ fontSize: '1.1rem', fontWeight: 700 }}
    >
      {statusKey}
    </span>
  )
}

export default StatusBadge
