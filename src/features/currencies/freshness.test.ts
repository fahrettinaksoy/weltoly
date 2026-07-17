import { describe, expect, it } from 'vitest'

import { rateFreshness } from './freshness'

/**
 * Asıl kural sezgiye ters: kaynaklar yalnız İŞ GÜNÜ yayımlar, bu yüzden hafta
 * sonu "dünkü kur" değil "cuma kuru" normaldir. Naif `rateDate === bugün`
 * kontrolü her hafta sonu yanlış alarm verir; kullanıcı uyarıyı yok saymaya
 * başlar ve GERÇEK bayatlığı da kaçırır.
 */

// 2026-07-17 Cuma, 18 Cts, 19 Paz, 20 Pzt
const FRI = new Date(2026, 6, 17, 12)
const SAT = new Date(2026, 6, 18, 12)
const SUN = new Date(2026, 6, 19, 12)
const MON = new Date(2026, 6, 20, 12)

describe('rateFreshness', () => {
  it('bugünün kuru taze', () => {
    expect(rateFreshness('2026-07-17', FRI)).toEqual({ level: 'fresh', ageDays: 0 })
  })

  it('dünkü kur taze (kaynaklar bir gün geriden yayımlar)', () => {
    // Frankfurter/TCMB 17 Temmuz'da 16 Temmuz kuru döndürüyor — normal.
    expect(rateFreshness('2026-07-16', FRI).level).toBe('fresh')
  })

  it('cUMARTESİ cuma kuru taze — hafta sonu yayın yok', () => {
    expect(rateFreshness('2026-07-17', SAT).level).toBe('fresh')
  })

  it('pAZAR cuma kuru hâlâ taze', () => {
    const f = rateFreshness('2026-07-17', SUN)
    expect(f.level).toBe('fresh')
    expect(f.ageDays).toBe(2) // takvim günü 2 ama iş günü 0
  })

  it('pAZARTESİ cuma kuru hâlâ taze (1 iş günü)', () => {
    expect(rateFreshness('2026-07-17', MON).level).toBe('fresh')
  })

  it('iki iş günü geride kalan kur BAYAT', () => {
    // 15 Çar kuru, 17 Cuma'da → 16 ve 17 = 2 iş günü.
    expect(rateFreshness('2026-07-15', FRI).level).toBe('stale')
  })

  it('bir haftalık kur kesinlikle bayat', () => {
    const f = rateFreshness('2026-07-10', FRI)
    expect(f.level).toBe('stale')
    expect(f.ageDays).toBe(7)
  })

  it('tarih yoksa bilinmiyor — "taze" DEMEZ', () => {
    // 006 öncesi satırlar veya tarih vermeyen kaynak. Uydurma güvence verilmez.
    expect(rateFreshness(null, FRI)).toEqual({ level: 'unknown', ageDays: null })
  })

  it('bozuk tarih bilinmiyor', () => {
    expect(rateFreshness('17.07.2026', FRI).level).toBe('unknown')
    expect(rateFreshness('', FRI).level).toBe('unknown')
  })

  it('gelecek tarihli kur bayat sayılmaz (saat dilimi kayması)', () => {
    expect(rateFreshness('2026-07-18', FRI).level).toBe('fresh')
  })
})
