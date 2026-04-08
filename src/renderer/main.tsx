import React from 'react'
import ReactDOM from 'react-dom/client'
import { MotionGlobalConfig } from 'framer-motion'
import App from './App'
import { ShowMachineProvider } from './machines/ShowMachineProvider'
import './index.css'

// Skip all Framer Motion animations in test mode for deterministic screenshots
if (process.env.NODE_ENV === 'test') {
  MotionGlobalConfig.skipAnimations = true
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ShowMachineProvider>
      <App />
    </ShowMachineProvider>
  </React.StrictMode>
)
