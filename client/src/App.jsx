import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import Dashboard from './pages/Dashboard'
import CaseDetail from './pages/CaseDetail'
import QuickAnalysis from './pages/QuickAnalysis'

const App = () => {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/case/:id" element={<CaseDetail />} />
          <Route path="/analyze" element={<QuickAnalysis />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}

export default App
