import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonts are served from this site (no Google Fonts request).
import '@fontsource-variable/manrope/wght.css'
import '@fontsource/dm-mono/400.css'
import '@fontsource/dm-mono/500.css'
import '../index.css'
import './admin.css'
import Admin from './Admin.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Admin />
  </StrictMode>,
)
