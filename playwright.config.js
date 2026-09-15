import { defineConfig, devices } from '@playwright/test';

// Roda contra a interface web pura (sem PyWebView) - DataContext.jsx já cai
// para localStorage sozinho quando window.pywebview não existe, então é o
// mesmo app real, só sem a ponte de arquivo local do desktop.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // --host explícito: sem isso, "vite preview" liga em "localhost", que em
    // alguns runners de CI resolve para ::1 (IPv6) - o servidor sobe, mas o
    // healthcheck do Playwright em 127.0.0.1 nunca conecta e estoura os 30s.
    command: 'npm run preview -- --port 4173 --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
