import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/dashboard': 'http://localhost:8083',
      '/resiliencia': 'http://localhost:8083',
      '/actuator': 'http://localhost:8083'
    }
  }
})