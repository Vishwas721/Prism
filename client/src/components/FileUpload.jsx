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
          <div className="icon">📄</div>
          <p className="title">Drag & Drop PDF</p>
          <p className="subtitle">or click to browse</p>
        </div>
      </div>
    </div>
  )
}

export default FileUpload
