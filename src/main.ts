import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRulesPlugin } from 'vuetify/labs/rules'

import App from './App.vue'
import { router } from './router'
import { vuetify } from './plugins/vuetify'
import { i18n } from './plugins/i18n'
import './plugins/echarts' // ECharts modül kaydı
import './assets/app.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(vuetify)
app.use(i18n)

// Doğrulama kuralları (rules): `:rules="['required']"` gibi string alias'ları
// etkinleştirir. ŞART: bu plugin kurulmazsa Vuetify alias'ı çözemez
// (composables/validation.js → useRules: `rules?.resolve(fn) ?? toRef(fn)`)
// ve string sessizce kural sayılmaz — hiçbir uyarı çıkmaz.
// Mesajlar Vuetify'ın kendi $vuetify.rules.* anahtarlarından gelir; i18n
// adapter'ımız tr/en/ru için bunları zaten gömüyor.
// NOT: labs — API'si minor sürümde değişebilir.
app.use(createRulesPlugin({}, vuetify.locale))

app.mount('#app')
