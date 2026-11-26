import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative asset URLs also let the production dashboard run as a local file preview.
  base: './',
  server: { port: 5173 },
})
