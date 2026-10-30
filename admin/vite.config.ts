import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Separate project: talks to the API over HTTP only (VITE_API_URL, default http://localhost:4000).
export default defineConfig({
  plugins: [react()],
  // Pure helpers shared with the app and the API (e.g. YouTube link parsing).
  resolve: { alias: { '@shared': fileURLToPath(new URL('../packages/shared/src', import.meta.url)) } },
  // Pre-bundle lazily found deps so the dev server never re-optimizes (and blanks open tabs) mid-session.
  optimizeDeps: { include: ['dayjs/plugin/relativeTime', 'recharts'] },
  server: { port: 5173, strictPort: true, fs: { allow: ['..'] }, watch: process.env.VITE_POLL ? { usePolling: true, interval: 300 } : undefined },
});
