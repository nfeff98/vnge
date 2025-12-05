import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import FullscreenCanvas from './components/FullscreenCanvas'

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <FullscreenCanvas />
    </StrictMode>
  )
}

