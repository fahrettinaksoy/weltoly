import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'

import { setLocale } from '@/plugins/i18n'
import type { LocaleCode } from '@/i18n/messages'

export type ThemeMode = 'system' | 'light' | 'dark'

/**
 * Uygulama geneli UI tercihleri. Faz 0'da tema + dil.
 * Kalıcılık şimdilik localStorage (VueUse); Faz 4'te tauri-plugin-store'a taşınabilir.
 */
export const useSettingsStore = defineStore('settings', () => {
  const themeMode = useLocalStorage<ThemeMode>('weltoly.themeMode', 'system')
  const locale = useLocalStorage<LocaleCode>('weltoly.locale', 'tr')

  function setThemeMode(mode: ThemeMode) {
    themeMode.value = mode
  }

  function setAppLocale(value: LocaleCode) {
    locale.value = value
    setLocale(value)
  }

  return {
    themeMode,
    locale,
    setThemeMode,
    setAppLocale,
  }
})
