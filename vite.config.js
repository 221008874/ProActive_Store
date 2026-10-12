import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // 5174, not the default 5173: the Admin panel runs there for the emulator
    // wiring tests, and both have to be up at the same time.
    port: 5174,
    // In dev the /api routes are served by `npx vercel dev` on :3000; the proxy
    // keeps the browser talking to one origin (and VITE_API_URL=/api working).
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        // pdfmake, leaflet and the Firebase SDK are only needed on a few
        // routes; splitting them lets the browser cache them independently
        // instead of re-downloading the whole 2.7 MB bundle on every change.
        manualChunks: {
          pdfmake: ['pdfmake', 'pdfmake/build/vfs_fonts'],
          leaflet: ['leaflet', 'react-leaflet'],
          firebase: ['firebase/app', 'firebase/firestore']
        }
      }
    }
  },
  test: {
    // Playwright specs live in the same repo and end in .spec.js, which is
    // exactly Vitest's default glob. Without this, `npm test` tries to run them
    // under Vitest and reports a confusing "suite failed to collect" error.
    exclude: ['playwright-tests/**', 'node_modules/**', 'dist/**']
  }
})