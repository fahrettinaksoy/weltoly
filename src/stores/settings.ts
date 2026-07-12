import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'

import { setLocale } from '@/plugins/i18n'
import { defaultPrimary } from '@/features/theme/palette'
import type { LocaleCode } from '@/i18n/messages'

export type ThemeMode = 'system' | 'light' | 'dark'

/**
 * Uygulama geneli UI tercihleri: tema modu, ana renk, dil.
 * Kalıcılık localStorage (VueUse); Faz 5+'te tauri-plugin-store'a taşınabilir.
 */
export const useSettingsStore = defineStore('settings', () => {
  const themeMode = useLocalStorage<ThemeMode>('weltoly.themeMode', 'system')
  const primaryColor = useLocalStorage<string>('weltoly.primaryColor', defaultPrimary)
  const locale = useLocalStorage<LocaleCode>('weltoly.locale', 'tr')

  function setThemeMode(mode: ThemeMode) {
    themeMode.value = mode
  }

  function setPrimaryColor(color: string) {
    primaryColor.value = color
  }

  function setAppLocale(value: LocaleCode) {
    locale.value = value
    setLocale(value)
  }

  return {
    themeMode,
    primaryColor,
    locale,
    setThemeMode,
    setPrimaryColor,
    setAppLocale,
  }
})
