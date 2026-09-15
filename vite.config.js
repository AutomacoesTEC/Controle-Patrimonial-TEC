import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, configDefaults } from 'vitest/config'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Important for Electron to resolve paths correctly
  build: {
    rollupOptions: {
      input: {
        web: fileURLToPath(new URL('./index.html', import.meta.url)),
        desktop: fileURLToPath(new URL('./desktop.html', import.meta.url)),
      },
    },
  },
  test: {
    // Os dois "dump" .audit não têm assertion nenhuma: rodam parsePDF e
    // GRAVAM JSON dentro de AUDITORIA/ (caminho versionado). São ferramenta de
    // inspeção, não teste — e sujavam o working tree a cada `npm test`. Ficam
    // fora da suíte padrão; para gerá-los, rode o arquivo diretamente
    // (`npx vitest run src/irpf/dumpParsePdf.audit.test.js`). Item OBS-T1 da
    // auditoria funcional 2026-09-09.
    exclude: [
      ...configDefaults.exclude,
      'src/irpf/dumpParsePdf.audit.test.js',
      'src/irpf/dumpRowsPdfjs.audit.test.js',
      'e2e/**', // suíte do Playwright, roda via "npm run test:e2e", não vitest
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      exclude: ['src/**/__fixtures__/**', 'src/**/*.test.js', 'src/**/*.audit.test.js'],
    },
  },
})
