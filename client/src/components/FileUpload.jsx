import React, { useCallback, useRef, useState } from 'react'
import clsx from 'clsx'

const FileUpload = ({ onFileSelected, disabled }) => {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef(null)

  const handleFiles = useCallback(
    (files) => {
      const file = files?.[0]
      if (file && onFileSelected) {
        onFileSelected(file)
      }
    },
    [onFileSelected]
  )

  const onDrop = (event) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
    if (disabled) return
    const files = event.dataTransfer?.files
    handleFiles(files)
  }

  const onDragOver = (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (!disabled) setIsDragging(true)
  }

  const onDragLeave = (event) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
  }

  const onClick = () => {
    if (disabled) return
    inputRef.current?.click()
  }

  const onChange = (event) => {
    handleFiles(event.target.files)
  }

  return (
    <div className="file-upload">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden-input"
        onChange={onChange}
        disabled={disabled}
      />
      <div
        className={clsx('drop-zone', {
          dragging: isDragging && !disabled,
          disabled,
        })}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={onClick}
      >
        <div className="drop-content">
          <svg className="drop-icon" width="40" height="40" viewBox="0 0 48 48" fill="none">
            <rect x="8" y="8" width="32" height="40" rx="4" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2"/>
            <path d="M16 24h16M16 32h12M16 40h8" stroke="#64748b" strokeWidth="2" strokeLinecap="round"/>
            <rect x="28" y="4" width="16" height="16" rx="8" fill="#4F46E5"/>
            <path d="M36 9v6M33 12h6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <p className="drop-title">Drag & Drop PDF</p>
          <p className="drop-subtitle">or click to browse files</p>
        </div>
      </div>
    </div>
  )
}

export default FileUpload
