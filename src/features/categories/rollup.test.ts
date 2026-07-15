import { describe, expect, it } from 'vitest'

import { getParentCategoryIdOrReturnSame } from './utils'
import type { Categories, CategoryItem } from './types'

/**
 * Cüzdan detayındaki pasta, gideri KÖK kategoriye toplar (WalletDetailPage
 * `rootCategoryId`). Bu test o toplamanın dayandığı yardımcıyı sabitler.
 *
 * Neden ayrı test: toplama hatası SESSİZDİR — pasta yine çizilir, sadece yanlış
 * dilimler gösterir. Özellikle "kök kendine toplanır" ve "sentetik kategoriler
 * (transfer/adjustment) kaybolmaz" durumları kolay bozulur.
 */
import type { CategoryId } from './types'

/** Testin ilgilendiği tek alan parentId; gerisi ağaç için anlamsız. */
function cat(name: string, parentId: CategoryId | 0): CategoryItem {
  return { name, parentId, desc: '', icon: '', color: '', showInLastUsed: true, showInQuickSelector: false, updatedAt: 0 }
}

const items: Categories = {
  // Kökler (parentId === 0)
  transport: cat('Ulaşım', 0),
  bills: cat('Faturalar', 0),
  // Çocuklar
  fuel: cat('Yakıt', 'transport'),
  transit: cat('Toplu Taşıma', 'transport'),
  electric: cat('Elektrik', 'bills'),
  // Sentetik kategoriler: gerçek ağaçta kök gibi dururlar.
  // `transfer` opsiyonel DEĞİL — Categories tipi onu şart koşuyor
  // (Record<CategoryId, CategoryItem> & Record<'transfer', CategoryItem>).
  adjustment: cat('Düzeltme', 0),
  transfer: cat('Transfer', 0),
}

const root = (id: string) => getParentCategoryIdOrReturnSame(items, id)

describe('kategori kök toplama', () => {
  it('çocuk kendi kökünü verir', () => {
    expect(root('fuel')).toBe('transport')
    expect(root('electric')).toBe('bills')
  })

  it('aynı kökün çocukları TEK kökte buluşur — toplamanın özü', () => {
    expect(root('fuel')).toBe(root('transit'))
  })

  it('kök kendini verir (kendi kendine toplanır, kaybolmaz)', () => {
    expect(root('transport')).toBe('transport')
  })

  it('sentetik kategori (adjustment) kök sayılır', () => {
    // parentId 0 → kendisi. Pastada zaten filtreleniyor ama burada kaybolursa
    // 'undefined' bir anahtara toplanırdı.
    expect(root('adjustment')).toBe('adjustment')
  })

  it('bilinmeyen kategori kendi id\'sini verir — çökmez', () => {
    // Kategori silinmiş ama işlem duruyor olabilir.
    expect(root('silinmis-kategori')).toBe('silinmis-kategori')
  })

  it('gerçek toplama: 13 yaprak → kök başına tek dilim', () => {
    const gider: Record<string, number> = { fuel: 1450, transit: 350, electric: 890 }
    const sums = new Map<string, number>()
    for (const [leaf, v] of Object.entries(gider))
      sums.set(root(leaf), (sums.get(root(leaf)) ?? 0) + v)

    expect(sums.get('transport')).toBe(1800)
    expect(sums.get('bills')).toBe(890)
    expect(sums.size).toBe(2)
  })
})
