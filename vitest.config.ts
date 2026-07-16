import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vitest/config'

// Ağırlıklı olarak saf mantık testleri (getTotal, transforms) — Vue/Tauri
// plugin'lerine gerek yok. Birkaç test Vuetify'ı bileşen olarak mount eder
// (ör. dateInputDefaults): bunun için aşağıdaki `deps.inline` şart.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    server: {
      deps: {
        // Vuetify dışsal bırakılırsa bileşen import'ları Node'un ESM
        // yükleyicisine düşer ve `VBtn.css` "Unknown file extension .css" ile
        // patlar — Node CSS yükleyemez. Inline etmek dosyaları Vite'ın
        // dönüşümünden geçirir; CSS import'ları `css: false` (vitest
        // varsayılanı) ile boş modüle indirgenir. Stil testi yapmıyoruz,
        // yalnız render edilen SINIF adlarına bakıyoruz — CSS'in kendisi
        // gereksiz.
        inline: ['vuetify'],
      },
    },
  },
})
