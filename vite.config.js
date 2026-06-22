import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base is relative so the built site works from any sub-path
// (GitHub Pages project site, local `vite preview`, file host, etc.).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, open: true },
  build: { outDir: 'dist', sourcemap: true },
})
