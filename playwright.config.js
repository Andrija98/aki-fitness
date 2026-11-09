import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// .env.local: Supabase URL i ključ.  .env.test.local: lozinke e2e naloga.
for (const file of ['.env.local', '.env.test.local']) {
  if (existsSync(file)) process.loadEnvFile(file);
}

export default defineConfig({
  testDir: 'e2e',
  workers: 1, // svi testovi dele iste e2e naloge, pa ne smeju paralelno
  timeout: 60_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
