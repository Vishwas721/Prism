import React from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

const JsonViewer = ({ data }) => {
  const formatted = data ? JSON.stringify(data, null, 2) : '{}'
  
  return (
    <div className="json-viewer-container">
      <SyntaxHighlighter 
        language="json" 
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          borderRadius: 8,
          fontSize: 13,
          lineHeight: 1.5,
          maxHeight: 400,
          overflow: 'auto'
        }}
        showLineNumbers
        wrapLines
      >
        {formatted}
      </SyntaxHighlighter>
    </div>
  )
}

export default JsonViewer
