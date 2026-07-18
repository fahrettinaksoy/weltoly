// @vitest-environment happy-dom
import { startOfDay } from 'date-fns'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Regresyon sessiz olurdu: donmuş bir "bu ay" hâlâ makul bir sayı gösterir.
 * Ancak gece yarısını geçen bir oturumda fark edilir — yani pratikte asla.
 *
 * `resetModules` + dinamik import ŞART: modül, zamanlayıcısını ve ref'ini MODÜL
 * DÜZEYİNDE (tekil) kurar. Statik import edilseydi ref, sahte saat kurulmadan
 * ÖNCE gerçek zamanla dolar; ayrıca ilk testte kurulan interval `useRealTimers`
 * ile atıldığı için sonraki testlerde bir daha ateşlenmezdi (`timer !== null`
 * olduğundan yeniden kurulmaz). Her test taze bir modül örneği alır.
 */
async function freshModule(now: Date) {
  vi.resetModules()
  vi.setSystemTime(now)
  const m = await import('./useCurrentDay')
  return m.useCurrentDay()
}

describe('useCurrentDay', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('günün başlangıcını verir (saat budanmış)', async () => {
    const day = await freshModule(new Date(2026, 6, 17, 14, 32))
    expect(day.value).toBe(startOfDay(new Date(2026, 6, 17)).getTime())
  })

  it('gün İÇİNDE değişmez — zincir boşuna tetiklenmesin', async () => {
    // DİKKAT: advanceTimersByTime sahte SAATİ de ilerletir. 08:00'den 10 saat
    // → 18:00, aynı gün. (23:59'dan ilerletmek gece yarısını geçerdi.)
    const day = await freshModule(new Date(2026, 6, 17, 8, 0))
    const before = day.value

    await vi.advanceTimersByTimeAsync(60_000 * 60 * 10)

    expect(day.value).toBe(before)
  })

  it('gece yarısı geçilince GÜNCELLENİR — asıl hata buydu', async () => {
    const day = await freshModule(new Date(2026, 6, 17, 23, 58))
    const before = day.value
    expect(before).toBe(startOfDay(new Date(2026, 6, 17)).getTime())

    // Saat kendiliğinden 18'ine geçer (interval kontrolü ~dakikada bir).
    await vi.advanceTimersByTimeAsync(60_000 * 5)

    expect(day.value).not.toBe(before)
    expect(day.value).toBe(startOfDay(new Date(2026, 6, 18)).getTime())
  })

  it("tekil kaynak: her çağrı AYNI ref'i döndürür", async () => {
    vi.resetModules()
    vi.setSystemTime(new Date(2026, 6, 17, 12))
    const { useCurrentDay } = await import('./useCurrentDay')
    // Bileşen başına ayrı zamanlayıcı/ref kurulmamalı.
    expect(useCurrentDay()).toBe(useCurrentDay())
  })
})
