import { startOfDay } from 'date-fns'
// `ref` AÇIKÇA import edilir: bu modülü testler doğrudan import ediyor ve
// vitest.config'te AutoImport plugin'i YOK (yalnız vite.config'te var) — auto
// import'a güvenilseydi test "ref is not defined" ile patlardı. Uygulama
// build'inde de sorun değil: AutoImport yalnız tanımsız isimleri enjekte eder.
import { ref } from 'vue'

/**
 * Gün granülerliğinde REAKTİF "bugün" (A-5).
 *
 * SORUN: `computed(() => startOfMonth(Date.now()))` gibi ifadelerin reaktif
 * bağımlılığı YOKTUR. Vue onu ilk değerlendirmede önbelleğe alır ve bir daha
 * ASLA invalidate etmez — `Date.now()` bir ref değil, düz bir çağrı. Masaüstü
 * uygulaması günlerce açık kalabildiği için sonuç: gece yarısı geçer, "Bu ay"
 * kartları eski ayı göstermeye devam eder ve hiçbir şey onları tazelemez.
 * Kullanıcı yanlış rakama bakar, üstelik yanlış olduğuna dair bir işaret yoktur.
 *
 * NEDEN DAKİKALIK "now" DEĞİL: `useNow({ interval: 60_000 })` bağımlılığı
 * kurardı ama her dakika tetiklerdi; `thisMonth` her seferinde YENİ bir nesne
 * döndürdüğü için ona bağlı tüm zincir (aylık akış → tam işlem taraması) dakikada
 * bir yeniden çalışırdı. Burada ref YALNIZ gün değişince değişir → zincir günde
 * bir kez, gerçekten gerektiğinde tazelenir.
 *
 * Zamanlayıcı MODÜL DÜZEYİNDE tektir: bileşen başına bir interval kurmak
 * (Panel + cüzdan detayı aynı anda açıkken) gereksiz olurdu.
 */

const currentDay = ref(startOfDay(Date.now()).getTime())

/** Gün dönümünü yakalamak için yeterince sık, ama bedeli ihmal edilebilir. */
const CHECK_INTERVAL_MS = 60_000

let timer: ReturnType<typeof setInterval> | null = null

function ensureTimer(): void {
  // SSR/test ortamında zamanlayıcı kurma — sızıntı yapar, faydası yok.
  if (timer !== null || typeof window === 'undefined')
    return
  timer = setInterval(() => {
    const day = startOfDay(Date.now()).getTime()
    // Şart: aynı değeri yeniden atamak ref'i tetiklemez ama niyeti açık tutar —
    // yalnız GÜN döndüğünde aşağıdaki zincir yeniden hesaplanır.
    if (day !== currentDay.value)
      currentDay.value = day
  }, CHECK_INTERVAL_MS)
}

/**
 * Günün başlangıcı (ms). Gece yarısı değişir.
 *
 * Tam saat gerektiren hesaplarda da bağımlılık olarak okunabilir:
 * `void today.value` yazıp `Date.now()` kullanmak, "tam zaman" anlamını
 * korurken gün dönümünde tazelenmeyi sağlar.
 */
export function useCurrentDay() {
  ensureTimer()
  return currentDay
}
