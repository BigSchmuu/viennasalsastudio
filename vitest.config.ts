import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

process.env = { ...process.env, ...loadEnv('', process.cwd(), '') }

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Playwright E2E specs live in tests/*.spec.ts — scope Vitest to its own
    // *.test.ts files only (default `exclude` for node_modules etc. still
    // applies; see playwright.config.ts for the mirrored testMatch
    // restricting Playwright to *.spec.ts only).
    include: ['**/*.test.ts?(x)'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
