import React from 'react'
import ReactDOM from 'react-dom/client'
import '@connectio/design-system/tokens'
import '@connectio/design-system/shell'
import { App } from './App.js'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
