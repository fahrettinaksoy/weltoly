import { describe, expect, it } from 'vitest'

import { dateRangeText } from '@/shared/lib/dateRange'

/**
 * Regresyon kilidi: VDateInput range modunda tek gün seçilince tarihi İKİ KEZ
 * yazıyordu ("09.07.2026 - 09.07.2026"). DateRangeField bu metni kendi kuruyor;
 * tek gün tek tarih göstermeli. Sessiz görsel regresyon → testle yakalanmalı.
 */
const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`

describe('dateRangeText', () => {
  it('boş dizi → boş metin', () => {
    expect(dateRangeText([], fmt)).toBe('')
  })

  it('tek gün → tek tarih (çift YAZMAZ)', () => {
    expect(dateRangeText([new Date(2026, 6, 9)], fmt)).toBe('09.07.2026')
  })

  it('başlangıç = bitiş (iki eleman, aynı gün) → tek tarih', () => {
    expect(dateRangeText([new Date(2026, 6, 9), new Date(2026, 6, 9)], fmt)).toBe('09.07.2026')
  })

  it('gerçek aralık → "başlangıç - bitiş"', () => {
    expect(dateRangeText([new Date(2026, 6, 9), new Date(2026, 6, 15)], fmt)).toBe('09.07.2026 - 15.07.2026')
  })

  it('aralığın uçları ilk ve SON eleman', () => {
    const days = [new Date(2026, 6, 9), new Date(2026, 6, 12), new Date(2026, 6, 15)]
    expect(dateRangeText(days, fmt)).toBe('09.07.2026 - 15.07.2026')
  })
})
