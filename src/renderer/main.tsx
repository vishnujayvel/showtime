import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ShowMachineProvider } from './machines/ShowMachineProvider'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ShowMachineProvider>
      <App />
    </ShowMachineProvider>
  </React.StrictMode>
)
