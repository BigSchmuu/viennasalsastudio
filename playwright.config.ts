import { defineConfig, devices } from '@playwright/test'

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
    baseURL: 'http://localhost:3000',
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
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
