import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy local para desarrollo: replica el comportamiento de las serverless functions
    proxy: {
      '/api/dolares': {
        target: 'https://dolarapi.com',
        changeOrigin: true,
        rewrite: () => '/v1/dolares',
      },
      '/api/usdt': {
        target: 'https://criptoya.com',
        changeOrigin: true,
        rewrite: () => '/api/usdt/ars/1',
      },
      '/api/usdc': {
        target: 'https://criptoya.com',
        changeOrigin: true,
        rewrite: () => '/api/usdc/ars/1',
      },
    },
  },
})
