import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // In dev the /api routes are served by `npx vercel dev` on :3000; the proxy
  // keeps the browser talking to one origin (and VITE_API_URL=/api working).
  server: {
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
  }
})
