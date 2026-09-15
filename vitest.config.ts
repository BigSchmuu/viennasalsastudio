import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { ladeTestUmgebung } from './tests/env'

process.env = { ...process.env, ...loadEnv('', process.cwd(), '') }

// Drei Testdateien sprechen die Datenbank direkt an (PROJ-1, PROJ-23, PROJ-39).
// Ohne diese Zeile liefen sie mit den Zugangsdaten aus .env.local, also gegen
// die Produktion. Muss *nach* loadEnv stehen -- sonst gewinnt .env.local.
ladeTestUmgebung()

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
    // Die Datenbanktests teilen sich eine Testdatenbank und ein Supabase-Projekt.
    // Parallel gestartet liefen sie in die Drosselung der Anmeldung
    // ("Request rate limit reached") -- und zwar mal so, mal so. Nacheinander
    // kostet ein paar Sekunden und ist dafuer verlaesslich.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
