// components/ui/InstallPrompt.tsx
// A small dismissible banner offering to install SEMP as a home-screen
// app (PWA). Only renders when the browser has actually fired
// `beforeinstallprompt` — that only happens on Chromium-based browsers
// (Chrome/Edge/Android), over HTTPS, with a registered service worker
// and manifest already in place (see public/sw.js, public/manifest.json,
// index.html). Safari/iOS never fires this event — there's no
// programmatic install prompt there, only the manual "Share > Add to
// Home Screen" flow, which this component can't trigger.

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'semp_install_prompt_dismissed';

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true // iOS Safari's own flag
  );
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === 'true');

  useEffect(() => {
    if (isStandalone()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true');
    setDismissed(true);
  };

  if (!deferredPrompt || dismissed || isStandalone()) return null;

  return (
    <div
      className="d-flex align-items-center gap-3 p-3 mb-4"
      style={{
        backgroundColor: 'rgba(var(--accent-primary-rgb), 0.08)',
        border: '1px solid rgba(var(--accent-primary-rgb), 0.25)',
        borderRadius: 'var(--radius-md)',
      }}
      role="region"
      aria-label="Install SEMP app"
    >
      <div
        className="d-flex align-items-center justify-content-center flex-shrink-0"
        style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'var(--accent-primary)' }}
      >
        <i className="bi bi-download" style={{ color: '#ffffff', fontSize: '1.1rem' }} />
      </div>

      <div className="flex-grow-1">
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Install SEMP
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Add it to your home screen for faster access — opens like a regular app.
        </div>
      </div>

      <div className="d-flex gap-2 flex-shrink-0">
        <button
          type="button"
          className="btn btn-sm btn-primary"
          style={{ fontSize: '0.78rem' }}
          onClick={handleInstall}
        >
          Install
        </button>
        <button
          type="button"
          className="btn btn-sm"
          style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'transparent', border: 'none' }}
          onClick={handleDismiss}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
