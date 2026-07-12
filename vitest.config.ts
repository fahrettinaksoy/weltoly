import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vitest/config'

// Saf mantık testleri (getTotal, transforms) - Vuetify/Tauri plugin'lerine gerek yok.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
