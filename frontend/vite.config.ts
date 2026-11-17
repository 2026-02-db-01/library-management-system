import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
const githubPages = process.env.VITE_GITHUB_PAGES === 'true'

export default defineConfig({
  base: githubPages ? '/library-management-system/' : '/',
  plugins: [react(), tailwindcss()],
})
