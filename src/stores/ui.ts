import { defineStore } from 'pinia'

import { i18n } from '@/plugins/i18n'

type SnackColor = 'error' | 'success' | 'info'

/** Global snackbar/toast durumu (App.vue render eder). */
export const useUiStore = defineStore('ui', () => {
  const snackbar = reactive({
    show: false,
    message: '',
    color: 'info' as SnackColor,
  })

  function showToast(message: string, color: SnackColor = 'info') {
    snackbar.message = message
    snackbar.color = color
    snackbar.show = true
  }

  return { snackbar, showToast }
})

/** Store'ların çağırdığı hata bildirimi. i18n anahtarını çözer. */
export function showErrorToast(key: string): void {
  const msg = i18n.global.t(key)
  useUiStore().showToast(typeof msg === 'string' ? msg : key, 'error')
}
