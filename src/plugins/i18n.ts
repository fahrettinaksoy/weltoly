import { createI18n } from 'vue-i18n'

import { messages, type LocaleCode } from '@/i18n/messages'

const STORAGE_KEY = 'weltoly.locale'

function detectLocale(): LocaleCode {
  const stored = localStorage.getItem(STORAGE_KEY) as LocaleCode | null
  if (stored && stored in messages)
    return stored
  const nav = navigator.language.slice(0, 2)
  if (nav === 'tr' || nav === 'ru')
    return nav
  return 'en'
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true, // şablonlarda $t kullanımı için
  locale: detectLocale(),
  fallbackLocale: 'en',
  messages,
})

export function setLocale(locale: LocaleCode) {
  i18n.global.locale.value = locale
  localStorage.setItem(STORAGE_KEY, locale)
  document.documentElement.setAttribute('lang', locale)
}
