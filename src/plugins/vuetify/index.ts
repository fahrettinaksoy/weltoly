import { useI18n } from 'vue-i18n'
import { createVuetify } from 'vuetify'

import { createVueI18nAdapter } from 'vuetify/locale/adapters/vue-i18n'
import { i18n } from '@/plugins/i18n'
import { aliasDefaults, aliases as componentAliases } from './aliases'

import { defaults } from './defaults'
import { icons } from './icons'
import { themeConfig } from './theme'
// Vuetify'ın TAM önceden-derlenmiş stil dosyası (reset + utility'ler + tüm bileşen stilleri).
// vite.config'te `styles: { configFile }` KULLANILMADIĞI için bu import düz CSS yükler —
// SASS anlık derleme yok, dolayısıyla .sass 404 / beyaz ekran sorunu da yok.
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'

// Enterprise Vuetify kurulumu — tüm özellikler tek yerde composed:
// theme · global-configuration (defaults) · aliasing · icon-fonts · internationalization
export const vuetify = createVuetify({
  aliases: componentAliases,
  defaults: { ...defaults, ...aliasDefaults },
  theme: themeConfig,
  icons,
  locale: {
    // internationalization: Vuetify bileşen metinleri vue-i18n üzerinden çevrilir.
    // Not: adapter gevşek-tipli I18n bekler; güçlü tipli örneğimizi bu sınırda cast'liyoruz.
    adapter: createVueI18nAdapter({ i18n: i18n as any, useI18n })
  }
})
