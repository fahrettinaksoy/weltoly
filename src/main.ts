import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { createRulesPlugin } from 'vuetify/labs/rules'

import App from './App.vue'
import { i18n } from './plugins/i18n'
import { vuetify } from './plugins/vuetify'
import { router } from './router'
import { logger } from './shared/lib/logger'
import { showErrorToast } from './stores/ui'
import './assets/app.css'

// NOT: ECharts modül kaydı BİLİNÇLİ OLARAK burada DEĞİL.
// Buradan import edilirse tüm ECharts (core + Bar/Line/Pie + Grid/Tooltip/
// Legend/MarkLine + zrender) ana bundle'a girer; rotalar lazy olsa bile Panel'e
// giren kullanıcı hiç grafik görmeden ~1 MB'ı indirmiş olur. Kayıt artık
// grafiği gerçekten çizen iki bileşende (StatChart, WalletBalanceChart) —
// ECharts onların lazy chunk'ına düşer. Modül ESM tekil olduğu için iki
// bileşen de import etse `use([...])` bir kez çalışır.

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(vuetify)
app.use(i18n)

// Gözlemlenebilirlik: HİÇBİR hata sessizce yutulmasın.
// Öncesinde global bir yakalayıcı yoktu — bir bileşende fırlayan hata kullanıcıya
// beyaz ekran olarak yansıyor, hiçbir iz bırakmıyordu. Artık üçü de kalıcı log'a
// (logger → tauri-plugin-log dosyası) düşer; bileşen hatasında kullanıcı da bilgilendirilir.
app.config.errorHandler = (err, _instance, info) => {
  logger.error(`[vue] yakalanmamış hata (${info})`, err)
  // showErrorToast eksik anahtarda anahtarın kendisini gösterir — asla patlamaz.
  showErrorToast('errors.unexpected')
}

// Promise reddi ve pencere düzeyi hatalar genelde üçüncü taraf/gürültülü olur —
// kalıcı olarak LOG'lanır ama kullanıcı toast'ıyla spam yapılmaz.
window.addEventListener('unhandledrejection', (event) => {
  logger.error('[window] işlenmemiş promise reddi', event.reason)
})
window.addEventListener('error', (event) => {
  logger.error('[window] yakalanmamış hata', event.error ?? event.message)
})

// Doğrulama kuralları (rules): `:rules="['required']"` gibi string alias'ları
// etkinleştirir. ŞART: bu plugin kurulmazsa Vuetify alias'ı çözemez
// (composables/validation.js → useRules: `rules?.resolve(fn) ?? toRef(fn)`)
// ve string sessizce kural sayılmaz — hiçbir uyarı çıkmaz.
// Mesajlar Vuetify'ın kendi $vuetify.rules.* anahtarlarından gelir; i18n
// adapter'ımız tr/en/ru için bunları zaten gömüyor.
// NOT: labs — API'si minor sürümde değişebilir.
app.use(createRulesPlugin({}, vuetify.locale))

app.mount('#app')
