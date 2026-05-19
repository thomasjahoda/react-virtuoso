import type { PlaywrightTestConfig } from '@playwright/test'

const config: PlaywrightTestConfig = {
  testDir: './e2e',
  webServer: {
    command: 'npm run ladle',
    port: 61000,
    timeout: 120 * 1000,
    reuseExistingServer: process.env.CI === undefined || process.env.CI === '',
  },
}
export default config
