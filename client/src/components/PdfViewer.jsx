import React, { useState, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'

// Set up the worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

const PdfViewer = ({ fileUrl, highlightPage, onClose }) => {
  const [numPages, setNumPages] = useState(null)
  const [pageNumber, setPageNumber] = useState(highlightPage || 1)
  const [scale, setScale] = useState(1.0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const onDocumentLoadSuccess = useCallback(({ numPages }) => {
    setNumPages(numPages)
    setLoading(false)
    // Jump to highlight page if specified
    if (highlightPage && highlightPage <= numPages) {
      setPageNumber(highlightPage)
    }
  }, [highlightPage])

  const onDocumentLoadError = useCallback((err) => {
    console.error('PDF load error:', err)
    setError('Failed to load PDF document')
    setLoading(false)
  }, [])

  const goToPrevPage = () => {
    setPageNumber(prev => Math.max(1, prev - 1))
  }

  const goToNextPage = () => {
    setPageNumber(prev => Math.min(numPages || 1, prev + 1))
  }

  const goToPage = (page) => {
    if (page >= 1 && page <= (numPages || 1)) {
      setPageNumber(page)
    }
  }

  const zoomIn = () => setScale(prev => Math.min(2.5, prev + 0.2))
  const zoomOut = () => setScale(prev => Math.max(0.5, prev - 0.2))
  const resetZoom = () => setScale(1.0)

  return (
    <div className="pdf-viewer-wrapper">
      {/* Top Control Bar */}
      <div className="pdf-top-bar">
        <div className="pdf-nav-controls">
          <button 
            className="pdf-nav-btn"
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            title="Previous page"
          >
            ‹
          </button>
          <span className="pdf-page-info">
            <input
              type="number"
              value={pageNumber}
              onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
              min={1}
              max={numPages || 1}
              className="pdf-page-input"
            />
            <span className="pdf-page-divider">/</span>
            <span>{numPages || '-'}</span>
          </span>
          <button 
            className="pdf-nav-btn"
            onClick={goToNextPage}
            disabled={pageNumber >= (numPages || 1)}
            title="Next page"
          >
            ›
          </button>
        </div>

        <div className="pdf-zoom-controls">
          <button className="pdf-zoom-btn" onClick={zoomOut} title="Zoom out">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          </button>
          <span className="pdf-zoom-level">{Math.round(scale * 100)}%</span>
          <button className="pdf-zoom-btn" onClick={zoomIn} title="Zoom in">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
              <line x1="11" y1="8" x2="11" y2="14"/>
            </svg>
          </button>
          <button className="pdf-zoom-btn" onClick={resetZoom} title="Reset zoom">
            ↻
          </button>
        </div>

        <button className="pdf-close-btn" onClick={onClose} title="Close viewer">
          ✕
        </button>
      </div>

      {/* PDF Content */}
      <div className="pdf-content-area">
        {loading && (
          <div className="pdf-loading">
            <div className="pdf-spinner"></div>
            <p>Loading document...</p>
          </div>
        )}

        {error && (
          <div className="pdf-error">
            <p>{error}</p>
            <button className="btn-secondary" onClick={() => window.open(fileUrl, '_blank')}>
              Open in new tab
            </button>
          </div>
        )}

        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={null}
          className="pdf-document"
        >
          <Page 
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className={`pdf-page ${pageNumber === highlightPage ? 'pdf-page-highlighted' : ''}`}
          />
        </Document>
      </div>

      {/* Page Thumbnails (optional quick nav) */}
      {numPages && numPages > 1 && (
        <div className="pdf-thumbnails">
          {Array.from({ length: Math.min(numPages, 10) }, (_, i) => i + 1).map(page => (
            <button
              key={page}
              className={`pdf-thumbnail-btn ${page === pageNumber ? 'active' : ''} ${page === highlightPage ? 'highlighted' : ''}`}
              onClick={() => goToPage(page)}
            >
              {page}
            </button>
          ))}
          {numPages > 10 && <span className="pdf-more-pages">...</span>}
        </div>
      )}
    </div>
  )
}

export default PdfViewer
