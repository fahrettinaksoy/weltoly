import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import vuetify from 'vite-plugin-vuetify'
import { defineConfig } from 'vitest/config'

// Ağırlıklı olarak saf mantık testleri (getTotal, transforms) — Vue/Tauri
// plugin'lerine gerek yok. Ama App.boot.test.ts gerçek `App.vue`'yu mount eder;
// bunun için aşağıdaki plugin yığını (vite.config ile AYNI) şart: vue derler,
// vuetify + Components bileşenleri, AutoImport da ref/computed/useRoute gibi
// global API'leri .vue/.ts içine enjekte eder. `dts: false` — testte üretilen
// tip dosyası YAZILMAZ (kaynak ağacını kirletmesin; O-14).
export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: { labs: true } }),
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia', '@vueuse/core'],
      dts: false,
      dirs: ['src/composables'],
      vueTemplate: true,
    }),
    Components({ dts: false, dirs: ['src/components'] }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'lcov'],
      // Kapsam yalnız SAF MANTIK (.ts) üzerinden ölçülür. .vue bileşenleri birim
      // testinin hedefi değil (davranışları E2E/etkileşim testinin işi); onları
      // dahil etmek yüzdeyi anlamsızca düşürür ve eşiği oyuna açar.
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'src/main.ts', // uygulama bootstrap — birim testi değil, smoke/E2E kapsamı
        'src/i18n/messages.ts', // saf veri sözlüğü
        'src/**/types.ts',
        'src/plugins/**', // vuetify/i18n/echarts kurulum kabloları
      ],
      // Ölçülen tabanın ALTINA düşüş regresyondur. Değerler mevcut kapsamın hemen
      // altına konur (ratchet) — kapı bugün yeşil, ama örtülü kod eklenince kırmızı.
      thresholds: {
        statements: 52,
        branches: 80,
        functions: 39,
        lines: 52,
      },
    },
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
