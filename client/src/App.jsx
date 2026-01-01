import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import CaseDetail from './pages/CaseDetail'
import QuickAnalysis from './pages/QuickAnalysis'

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/case/:id" element={<CaseDetail />} />
        <Route path="/analyze" element={<QuickAnalysis />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
