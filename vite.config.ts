import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import vuetify from 'vite-plugin-vuetify'

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    vue(),
    // Vuetify: bileşen otomatik import (JS treeshaking). Stiller ÖNCEDEN DERLENMİŞ CSS
    // olarak `import 'vuetify/styles'` ile yüklenir (plugins/vuetify/index.ts).
    // NOT: `styles: { configFile }` (SASS treeshaking) BİLİNÇLİ kullanılmıyor — o mod
    // `import 'vuetify/styles'` ile birleşince kullanılmayan bileşenlerin .sass'ını
    // anlık derlemeye çalışıp 404 veriyor ve VApp.sass 404'ü beyaz ekrana yol açıyordu.
    // labs: true → VPie/VHeatmap gibi labs bileşenleri de otomatik import edilir
    // (importMap-labs.json). Bunlar Vuetify'da henüz kararlı değil; API'leri
    // minor sürümde değişebilir.
    vuetify({ autoImport: { labs: true } }),
    // ref/computed/watch/store/router gibi API'ler için otomatik import
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia', '@vueuse/core'],
      dts: 'src/auto-imports.d.ts',
      dirs: ['src/composables'],
      vueTemplate: true
    }),
    // Kendi bileşenlerimizi otomatik import et
    Components({
      dts: 'src/components.d.ts',
      dirs: ['src/components']
    })
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },

  /**
   * Tauri hedefi SABİT bir WebView'dir — tarayıcı pazarı değil.
   *   - macOS/iOS : WKWebView   (tauri.conf minimumSystemVersion 10.15 → Safari 13)
   *   - Windows   : WebView2    (Chromium; Tauri asgarisi Chrome 105)
   *   - Linux     : WebKitGTK
   * Tauri'nin resmî vite şablonuyla aynı değerler.
   *
   * ⚠️ BU BİR BOYUT OPTİMİZASYONU DEĞİL, UYUMLULUK DÜZELTMESİDİR.
   * Vite'ın varsayılanı `'modules'` = ['es2020','edge88','firefox78','chrome87',
   * **'safari14'**]. Ama tauri.conf 10.15 (Catalina → Safari 13) diyor: yani
   * bundle, uygulamanın desteklediğini İDDİA ETTİĞİ macOS'ta çalışmayabilecek
   * sözdizimi taşıyordu ve bu ancak o makinede, çalışma anında patlardı.
   * Ölçüldü: safari13 hedefi ana chunk'ı 730.781 → 737.058 B'ye ÇIKARIYOR
   * (+6,3 kB ek transpile). Doğru bedel — 6 kB için sessiz bir uyumsuzluk
   * taşınmaz. (Windows/chrome105 tarafı 713.807 B'ye iniyor.)
   *
   * `minify`/`sourcemap`: `tauri dev` debug build'de kaynak haritası ister,
   * release'de istemez. TAURI_ENV_* değişkenlerini Tauri CLI enjekte eder.
   */
  build: {
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: process.env.TAURI_ENV_DEBUG ? false : 'esbuild',
    sourcemap: !!process.env.TAURI_ENV_DEBUG
  },

  // Tauri geliştirmesi için ayarlar (yalnız `tauri dev`/`tauri build` sırasında geçerli)
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: {
      ignored: ['**/src-tauri/**']
    }
  }
}))
