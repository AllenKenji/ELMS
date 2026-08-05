import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('react-dom') || id.includes('react')) {
            return 'react-vendor'
          }

          if (id.includes('socket.io-client')) {
            return 'socket'
          }

          if (id.includes('react-icons')) {
            return 'icons'
          }

          return 'vendor'
        },
      },
    },
  },
})
