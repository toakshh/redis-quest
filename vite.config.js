import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    reportCompressedSize: false,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
    testTimeout: 10000,
  },
})
