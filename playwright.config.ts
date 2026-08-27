import { defineConfig, devices } from '@playwright/test'
import { ladeTestUmgebung } from './tests/env'

// Vor allem anderen: Die Tests laufen ausschliesslich gegen die
// Testdatenbank. ladeTestUmgebung() bricht ab, wenn .env.test fehlt oder auf
// die Produktion zeigt — ein stiller Rueckfall waere genau der Unfall, den
// die Trennung verhindern soll.
ladeTestUmgebung()

// Ein eigener Port, nicht 3000. Auf 3000 laeuft der Entwicklungsserver mit den
// Produktionsdaten; mit reuseExistingServer haette Playwright ihn
// uebernommen und stillschweigend gegen die Produktion getestet.
const TEST_PORT = 3100

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  // Tests share a single `npm run dev` server. Auth/session-heavy specs were
  // observed to flake under concurrent load against that one dev server
  // (even at 3 workers) — run serially so results are deterministic.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${TEST_PORT}`,
    // PROJ-43: Seit die App zweisprachig ist, entscheidet die Browsersprache
    // beim ersten Aufruf. Playwright meldet standardmaessig en-US — ohne diese
    // Zeile landet jeder Test auf /en und sucht vergeblich nach deutschen
    // Beschriftungen. Die bestehenden Suiten pruefen die deutsche Fassung, also
    // treten sie als deutschsprachige Besucher auf. Die englische Fassung hat
    // ihre eigene Suite, die den Wert je Test ueberschreibt.
    locale: 'de-DE',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: `npm run dev -- --port ${TEST_PORT}`,
    url: `http://localhost:${TEST_PORT}`,
    // Nicht wiederverwenden: Ein bereits laufender Server koennte mit den
    // Produktionsdaten gestartet worden sein.
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      NEXT_PUBLIC_SITE_URL: `http://localhost:${TEST_PORT}`,
      SEPA_CREDITOR_NAME: process.env.SEPA_CREDITOR_NAME ?? 'Vienna Salsa Studio Test',
      SEPA_CREDITOR_IBAN: process.env.SEPA_CREDITOR_IBAN ?? 'AT611904300234573201',
      SEPA_CREDITOR_ID: process.env.SEPA_CREDITOR_ID ?? 'AT12ZZZ00000000001',
      CRON_SECRET: process.env.CRON_SECRET ?? 'test-cron-secret',
    },
  },
})
