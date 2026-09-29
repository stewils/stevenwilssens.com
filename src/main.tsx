import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startAnalytics } from './analytics'

const root = document.getElementById('root')!
const app = <StrictMode><App /></StrictMode>
// Built pages arrive prerendered (scripts/prerender.mjs); the dev server serves an empty root.
if (root.hasChildNodes()) hydrateRoot(root, app)
else createRoot(root).render(app)

startAnalytics()
