import React from 'react'
import ReactDOM from 'react-dom/client'
import MidasTerminal from './MidasTerminal.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <MidasTerminal />
    </AuthProvider>
  </React.StrictMode>,
)
