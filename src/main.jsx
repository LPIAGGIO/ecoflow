import React from 'react'
import ReactDOM from 'react-dom/client'
import EcoFlowTerminal from './EcoFlowTerminal.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <EcoFlowTerminal />
    </AuthProvider>
  </React.StrictMode>,
)
