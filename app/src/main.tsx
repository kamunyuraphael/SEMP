import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'

// Register the service worker — required by most browsers for the
// "install app" (beforeinstallprompt) prompt to fire at all. See
// public/sw.js for what it does (and deliberately doesn't do).
// Skipped in dev: a registered SW intercepting Vite's dev-server
// requests/HMR is a common source of confusing "Failed to fetch"
// errors that have nothing to do with app code.
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Non-critical — the app works fine without it, install prompt
      // just won't be available on browsers that require one.
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
