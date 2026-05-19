import { StrictMode } from 'react'

import './index.css'
import { createRoot } from 'react-dom/client'

import { BasicRouter } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BasicRouter />
  </StrictMode>
)
