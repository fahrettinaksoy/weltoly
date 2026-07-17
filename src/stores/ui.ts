import { defineStore } from 'pinia'

import { i18n } from '@/plugins/i18n'

export type SnackColor = 'error' | 'success' | 'info' | 'warning'

/**
 * Kuyruk elemanı = VSnackbar prop objesi (VSnackbarQueue elemanı doğrudan
 * VSnackbar'a yayar). Vuetify'ın SnackbarMessage tipi 'vuetify/components'
 * üzerinden export EDİLMİYOR (yalnız bileşen ediliyor); derin dosya yolundan
 * import etmek yerine ihtiyacımız olan dar şekli burada tanımlıyoruz.
 *
 */
interface SnackbarMessage {
  text: string
  /** Zemin: duruma göre. Metin/ikon rengini Vuetify on-color olarak kendi çözer. */
  color: SnackColor
  prependIcon: string
  /** Zamanlayıcı çubuğu altta — metnin okunuşunu bölmez. */
  timer: 'bottom'
  /** Zeminin bir tık koyusu (theme.ts variations darken:3 üretiyor). */
  timerColor: string
}

/** Duruma karşılık gelen baştaki ikon. Renk tek başına anlam taşımamalı (erişilebilirlik). */
const iconByColor: Record<SnackColor, string> = {
  success: 'mdi-check-circle',
  error: 'mdi-alert-circle',
  warning: 'mdi-alert',
  info: 'mdi-information',
}

/**
 * Merkezî bildirim kuyruğu — projenin TEK bildirim kanalı.
 * App.vue tek bir <v-snackbar-queue> render eder ve bu kuyruğu tüketir.
 *
 * Neden kuyruk: tek snackbar'da art arda gelen iki mesajdan ikincisi birincinin
 * üstüne yazıyordu, yani bildirimler sessizce kaybolabiliyordu. Kuyrukta
 * mesajlar sıraya girer.
 *
 * NOT: VSnackbarQueue modeli TÜKETİR — gösterdiği elemanı diziden kendisi
 * çıkarır (v-model geri yazar). Burada yalnızca ekleme yapılır.
 */
export const useUiStore = defineStore('ui', () => {
  const snackbarQueue = ref<SnackbarMessage[]>([])

  /** Hazır metinle bildirim ekle (çeviri çağıranın sorumluluğu). */
  function showToast(message: string, color: SnackColor = 'info') {
    snackbarQueue.value = [...snackbarQueue.value, {
      text: message,
      color,
      prependIcon: iconByColor[color],
      timer: 'bottom',
      // Zeminle aynı renk ailesinden koyu ton → çubuk zeminden ayrışır ama
      // yabancı bir renk gibi durmaz. Sabit hex yerine tema varyasyonu:
      // primary/nötr palet değişince bu da birlikte kayar.
      timerColor: `${color}-darken-2`,
    }]
  }

  return { snackbarQueue, showToast }
})

/** i18n anahtarını çözer; çözülemezse anahtarın kendisi görünür (sessiz boş metin yerine). */
function translate(key: string, named?: Record<string, unknown>): string {
  const msg = named ? i18n.global.t(key, named) : i18n.global.t(key)
  return typeof msg === 'string' ? msg : key
}

/** Store'ların çağırdığı hata bildirimi. i18n anahtarı alır. */
export function showErrorToast(key: string, named?: Record<string, unknown>): void {
  useUiStore().showToast(translate(key, named), 'error')
}

/** Store'ların çağırdığı başarı bildirimi. i18n anahtarı alır. */
export function showSuccessToast(key: string, named?: Record<string, unknown>): void {
  useUiStore().showToast(translate(key, named), 'success')
}

/** Nötr bilgi bildirimi. i18n anahtarı alır. */
export function showInfoToast(key: string, named?: Record<string, unknown>): void {
  useUiStore().showToast(translate(key, named), 'info')
}
