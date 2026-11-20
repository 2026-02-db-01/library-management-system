import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
const githubPages = process.env.VITE_GITHUB_PAGES === 'true'

export default defineConfig({
  base: githubPages ? '/library-management-system/' : '/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // 개발 서버 전용: /api 요청을 로컬 FastAPI 로 넘긴다 (배포 시에는 웹 서버가 같은 역할)
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
