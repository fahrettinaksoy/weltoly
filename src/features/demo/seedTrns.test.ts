import { describe, expect, it } from 'vitest'

import { TrnType } from '@/features/trns/types'
import { trnToRow } from '@/services/db'
import { buildTrns } from './seed'

/**
 * Örnek veride HER işlemin açıklaması dolu olmalı.
 *
 * Neden test: açıklama sütunu artık tabloda ve süzgeçte. Eksik bir desc
 * SESSİZDİR — satır "—" gösterir, ne build ne typecheck fark eder (alan
 * opsiyonel). Yeni bir işlem eklerken desc unutulursa burası yakalar.
 *
 * Sabit `now`: seed tarihleri now'a göreli, testin saate bağlı olmaması için.
 */
const NOW = new Date('2026-07-15T12:00:00Z').getTime()
const trns = buildTrns(NOW)

describe('örnek veri: işlem açıklamaları', () => {
  it('her işlemin açıklaması dolu', () => {
    const bos = trns.filter((t) => !t.item.desc?.trim()).map((t) => t.id)
    expect(bos).toEqual([])
  })

  it('açıklama SQLite satırına yazılıyor (null düşmüyor)', () => {
    // trnToRow `item.desc ?? null` yapıyor; boş string de null'a düşerdi.
    const rows = trns.map((t) => trnToRow(t.item, 'local'))
    expect(rows.filter((r) => r.desc === null)).toEqual([])
  })

  it('açıklama kategori adının kopyası değil', () => {
    // Kategori sütunu zaten "ne için"i söylüyor; açıklama işleme özgü olanı
    // taşımalı, yoksa sütun boşuna yer kaplar.
    const gider = trns.find((t) => t.id === 'demo-t-exp-0')!
    expect(gider.item.desc).toBe('BİM — haftalık temel gıda')
  })

  it('transfer ve düzeltmeler de dahil — sessizce atlanmıyor', () => {
    const transfer = trns.filter((t) => t.item.type === TrnType.Transfer)
    const duzeltme = trns.filter((t) => t.item.categoryId === 'adjustment')
    expect(transfer.length).toBeGreaterThan(0)
    expect(duzeltme.length).toBeGreaterThan(0)
    expect([...transfer, ...duzeltme].every((t) => !!t.item.desc?.trim())).toBe(true)
  })

  it('gideri olan her cüzdana para GİRİYOR', () => {
    // Bu testin sebebi: eskiden maaş ziraat'a inip orada kalıyordu; garanti'den
    // faturalar çıkıyor ama hiç para girmiyordu (90 günde −17.000), kartların
    // ekstresi hiç ödenmiyordu. Hiçbir test/typecheck bunu görmezdi — yalnız
    // ekrana bakınca fark ediliyordu.
    // İstisna: borç cüzdanları (kredi/mortgage) taksiti GİDER kategorisi olarak
    // ödeniyor, bakiyeleri sabit — ayrı bir modelleme kararı, aşağıda ayrıca test.
    const BORC_CUZDANLARI = [
      'demo-w-mortgage',
      'demo-w-car-loan',
      'demo-w-loan',
      'demo-w-cardfinans'
    ]
    const giris = new Set<string>()
    const cikis = new Map<string, number>()
    for (const { item } of trns) {
      if (item.type === TrnType.Transfer) {
        giris.add(item.incomeWalletId)
        cikis.set(item.expenseWalletId, (cikis.get(item.expenseWalletId) ?? 0) + item.expenseAmount)
        continue
      }
      if (item.type === TrnType.Income) giris.add(item.walletId)
      else cikis.set(item.walletId, (cikis.get(item.walletId) ?? 0) + item.amount)
    }
    const parasiz = [...cikis.keys()].filter(
      (id) => !giris.has(id) && !BORC_CUZDANLARI.includes(id)
    )
    expect(parasiz).toEqual([])
  })

  it('kredi kartlarının ekstresi ödeniyor ve borç limiti aşmıyor', () => {
    const KARTLAR: Record<string, number> = {
      'demo-w-bonus': 30000,
      'demo-w-world': 25000,
      'demo-w-maximum': 40000
    }
    const bakiye: Record<string, number> = {}
    for (const { item } of trns) {
      if (item.type === TrnType.Transfer) {
        bakiye[item.expenseWalletId] = (bakiye[item.expenseWalletId] ?? 0) - item.expenseAmount
        bakiye[item.incomeWalletId] = (bakiye[item.incomeWalletId] ?? 0) + item.incomeAmount
        continue
      }
      bakiye[item.walletId] =
        (bakiye[item.walletId] ?? 0) + (item.type === TrnType.Income ? item.amount : -item.amount)
    }
    for (const [id, limit] of Object.entries(KARTLAR)) {
      const borc = -bakiye[id]!
      // Borç olmalı (kart kullanılıyor) ama limiti aşmamalı.
      expect(borc, `${id} borcu`).toBeGreaterThan(0)
      expect(borc, `${id} limiti aşıyor`).toBeLessThan(limit)
    }
  })

  it('fatura hesabı artıda kapanıyor — tek yönlü düşüş yok', () => {
    // Eski hali: 6.800 açılış, 23.830 gider, sıfır giriş → −17.030.
    let bakiye = 0
    for (const { item } of trns) {
      if (item.type === TrnType.Transfer) {
        if (item.expenseWalletId === 'demo-w-garanti') bakiye -= item.expenseAmount
        if (item.incomeWalletId === 'demo-w-garanti') bakiye += item.incomeAmount
        continue
      }
      if (item.walletId !== 'demo-w-garanti') continue
      bakiye += item.type === TrnType.Income ? item.amount : -item.amount
    }
    expect(bakiye).toBeGreaterThan(0)
  })

  it('negatif açılış "bakiye" değil BORÇ olarak yazılır', () => {
    // Konut kredisi (−420.000) "açılış bakiyesi" dese yanlış okunurdu.
    const kredi = trns.find((t) => t.id === 'demo-t-open-demo-w-mortgage')!
    expect(kredi.item.desc).toBe('Açılış borcu')
    expect(kredi.item.type).toBe(TrnType.Expense)

    const banka = trns.find((t) => t.id === 'demo-t-open-demo-w-ziraat')!
    expect(banka.item.desc).toBe('Açılış bakiyesi')
    expect(banka.item.type).toBe(TrnType.Income)
  })
})
