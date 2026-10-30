import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import * as Sentry from '@sentry/react';

import { message } from 'antd';

import App from './App';
import { ApiError, humanError } from './providers/api';

// Crash reporting only when a DSN is configured (VITE_SENTRY_DSN).
if (import.meta.env.VITE_SENTRY_DSN) Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, environment: import.meta.env.MODE, sendDefaultPii: false });

// After the dev server rebuilds its bundles, an open tab can hold stale chunk links; reload once instead of going blank.
window.addEventListener('vite:preloadError', () => {
  if (sessionStorage.getItem('reloaded')) return;
  sessionStorage.setItem('reloaded', '1');
  location.reload();
});
setTimeout(() => sessionStorage.removeItem('reloaded'), 10_000);

// Safety net: a save that fails and is not handled on its page still tells the user why, instead of doing nothing.
window.addEventListener('unhandledrejection', (ev) => {
  const e = ev.reason;
  if (!(e instanceof ApiError)) return;
  ev.preventDefault();
  message.error(humanError(e), 6);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
