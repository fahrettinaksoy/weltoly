import { describe, expect, it } from 'vitest'
import { changeRatio, deltaTone } from '@/features/stat/lib/periodCompare'

/**
 * ÜRETİM dönem-karşılaştırma modülünü test eder (Y-5).
 *
 * Eskiden bu dosya kendi içinde changeRatio/deltaTone KOPYASI taşıyordu; aynı
 * mantık ayrıca StatPage, DashboardPage ve WalletDetailPage içinde birebir
 * kopyalanmıştı. Beş kopyadan biri değişse test yeşil kalırdı — yanlış güven.
 * Artık tek kaynak: features/stat/lib/periodCompare.ts.
 *
 * Neden bu kurallar kilitli — hata SESSİZDİR: rozet yine çizilir, sadece yanlış
 * yön/renk gösterir; ne build ne typecheck fark eder. Kolay ters çevrilenler:
 * - önceki dönem 0 iken yüzde TANIMSIZDIR (0'a bölme → Infinity/NaN),
 * - gider ARTIŞI kötü, gelir artışı iyi — renk yöne bakarak verilemez,
 * - önceki dönem penceresi mevcut dönemle ÇAKIŞMAMALI (yarı açık aralık).
 */

const DAY = 86_400_000
const NOW = new Date('2026-07-15T12:00:00Z').getTime()

/** Mevcut ve önceki dönem pencereleri (sayfadaki periodStart/prevPeriodTrns ile aynı). */
function windows(days: number) {
  const start = NOW - days * DAY
  return { start, prevStart: start - days * DAY }
}

describe('dönem karşılaştırması', () => {
  it('artış ve azalış yüzdesi', () => {
    expect(changeRatio(120, 100)).toBe(20)
    expect(changeRatio(80, 100)).toBe(-20)
  })

  it('önceki dönem 0 ise yüzde YOK — Infinity yazılmaz', () => {
    // ((5 - 0) / 0) * 100 = Infinity. Ekranda "%Infinity arttı" çıkardı.
    expect(changeRatio(5, 0)).toBeNull()
    expect(changeRatio(0, 0)).toBeNull()
  })

  it('negatif tabanda yön DOĞRU kalır (mutlak değerle bölme)', () => {
    // Net −100'den −50'ye çıktıysa bu İYİLEŞMEDİR → pozitif yüzde.
    // Math.abs olmasaydı ((-50) - (-100)) / (-100) = −0.5 → yanlışlıkla "azalış".
    expect(changeRatio(-50, -100)).toBe(50)
  })

  it('gider artışı KIRMIZI, gelir artışı YEŞİL', () => {
    expect(deltaTone(20, false)).toBe('error') // gider arttı → kötü
    expect(deltaTone(20, true)).toBe('success') // gelir arttı → iyi
  })

  it('gider azalışı YEŞİL, gelir azalışı KIRMIZI', () => {
    expect(deltaTone(-20, false)).toBe('success')
    expect(deltaTone(-20, true)).toBe('error')
  })

  it('sıfıra yakın değişim NÖTR — olmayan eğilim boyanmaz', () => {
    expect(deltaTone(0.4, false)).toBeUndefined()
    expect(deltaTone(-0.9, true)).toBeUndefined()
  })

  it('önceki dönem penceresi mevcut dönemle ÇAKIŞMAZ', () => {
    const { start, prevStart } = windows(90)
    const inPrev = (d: number) => d >= prevStart && d < start
    const inCurrent = (d: number) => d >= start

    // Tam sınırdaki işlem YALNIZ mevcut döneme ait olmalı; `<` yerine `<=`
    // yazılsaydı iki pencerede birden sayılırdı.
    expect(inCurrent(start)).toBe(true)
    expect(inPrev(start)).toBe(false)

    expect(inPrev(start - 1)).toBe(true)
    expect(inCurrent(start - 1)).toBe(false)
  })

  it('önceki dönem mevcutla AYNI uzunlukta', () => {
    const { start, prevStart } = windows(90)
    expect(start - prevStart).toBe(90 * DAY)
    expect(NOW - start).toBe(90 * DAY)
  })
})
