import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules/**', '.next/**'],
    // The view tests mount the whole navigation over the real 2070-spell fixture,
    // which costs seconds per mount on a cold machine. The default 5 s made them
    // fail on load rather than on a defect, and a flaky suite gets ignored.
    testTimeout: 20_000,
  },
})
