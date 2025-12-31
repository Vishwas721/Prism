import React from 'react'

const JsonViewer = ({ data }) => {
  const formatted = data ? JSON.stringify(data, null, 2) : '{}'
  return (
    <pre className="json-viewer">
      {formatted}
    </pre>
  )
}

export default JsonViewer
