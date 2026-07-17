import type { NeutralKey } from '@/features/theme/palette'
import type { LocaleCode } from '@/i18n/messages'

import type { DateFormatKey, NumberFormatKey, WeekStart } from '@/shared/lib/format'
import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { DEFAULT_RADIUS, defaultNeutral, defaultPrimary } from '@/features/theme/palette'
import { setLocale } from '@/plugins/i18n'

export type ThemeMode = 'system' | 'light' | 'dark'

/**
 * Uygulama geneli UI tercihleri: tema modu, ana renk, dil.
 * Kalıcılık localStorage (VueUse); Faz 5+'te tauri-plugin-store'a taşınabilir.
 */
export const useSettingsStore = defineStore('settings', () => {
  const themeMode = useLocalStorage<ThemeMode>('weltoly.themeMode', 'system')
  const primaryColor = useLocalStorage<string>('weltoly.primaryColor', defaultPrimary)
  const neutral = useLocalStorage<NeutralKey>('weltoly.neutral', defaultNeutral)
  const radius = useLocalStorage<number>('weltoly.radius', DEFAULT_RADIUS)
  const locale = useLocalStorage<LocaleCode>('weltoly.locale', 'tr')

  // formatting: sayı/tarih/hafta biçimi. 'auto' = dile göre (yerel duruma göre).
  const numberFormat = useLocalStorage<NumberFormatKey>('weltoly.numberFormat', 'auto')
  const dateFormat = useLocalStorage<DateFormatKey>('weltoly.dateFormat', 'auto')
  const weekStart = useLocalStorage<WeekStart>('weltoly.weekStart', 1)
  const hideDecimals = useLocalStorage<boolean>('weltoly.hideDecimals', false)

  function setThemeMode(mode: ThemeMode) {
    themeMode.value = mode
  }

  function setPrimaryColor(color: string) {
    primaryColor.value = color
  }

  function setNeutral(key: NeutralKey) {
    neutral.value = key
  }

  function setRadius(px: number) {
    radius.value = px
  }

  function setAppLocale(value: LocaleCode) {
    locale.value = value
    setLocale(value)
  }

  function setNumberFormat(value: NumberFormatKey) {
    numberFormat.value = value
  }

  function setDateFormat(value: DateFormatKey) {
    dateFormat.value = value
  }

  function setWeekStart(value: WeekStart) {
    weekStart.value = value
  }

  function setHideDecimals(value: boolean) {
    hideDecimals.value = value
  }

  return {
    themeMode,
    primaryColor,
    neutral,
    radius,
    locale,
    numberFormat,
    dateFormat,
    weekStart,
    hideDecimals,
    setThemeMode,
    setPrimaryColor,
    setNeutral,
    setRadius,
    setAppLocale,
    setNumberFormat,
    setDateFormat,
    setWeekStart,
    setHideDecimals,
  }
})
