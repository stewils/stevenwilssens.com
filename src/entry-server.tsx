import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import App from './App.tsx'

export { markdownPath, pageMeta, pagePath, routes, siteUrl } from './pageMeta.ts'

// Used at build time by scripts/prerender.mjs to write each page's content into its HTML file.
export const render = (path: string) => renderToString(<StrictMode><App path={path} /></StrictMode>)
