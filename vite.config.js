import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Absolute base: prod is the root domain galathilion.ru, and deep paths like
// /book/:slug MUST reference /assets/* (with './' they resolve to /book/assets → 404).
// (Breaks sub-path hosting such as a GitHub Pages project site — not used for prod.)
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: { port: Number(process.env.PORT) || 5173 },
  build: { outDir: 'dist', sourcemap: true },
})
