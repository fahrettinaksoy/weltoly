import type { TxStatement } from './tx'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// runTx'i yakala: burada test edilen ŞEY, çok-adımlı silmenin TEK çağrıda
// gitmesi. Gerçek SQLite'a bağlanmak bunu ispatlamaz — atomiklik zaten Rust
// tarafında (src-tauri/src/tx.rs testleri) kanıtlanıyor. Burada kanıtlanan:
// JS katmanı işi tek transaction'a PAKETLİYOR mu, yoksa N+1 ayrı yazma mı?
// Parametre tipi açıkça verilir; yoksa mock.calls[0] `[]` (boş tuple) olarak
// çıkarılır ve indekslemek derleme hatası verir.
const runTx = vi.fn(async (_statements: TxStatement[]) => {})
const emitTableChange = vi.fn()

vi.mock('./tx', () => ({ runTx }))
vi.mock('./bus', () => ({ emitTableChange }))
vi.mock('./schema', () => ({
  isKnownTable: (t: string) => ['trns', 'wallets', 'categories'].includes(t)
}))

const { deleteRows } = await import('./mutations')

beforeEach(() => {
  runTx.mockClear()
  emitTableChange.mockClear()
})

describe('deleteRows', () => {
  it("her şeyi TEK transaction'da gönderir", async () => {
    await deleteRows([
      { id: 't1', table: 'trns' },
      { id: 't2', table: 'trns' },
      { id: 'w1', table: 'wallets' }
    ])

    // Asıl regresyon koruması: eskiden bu 3 ayrı deleteRow → 3 ayrı transaction'dı.
    expect(runTx).toHaveBeenCalledTimes(1)
  })

  it('her satır için DELETE + outbox kaydı yazar', async () => {
    await deleteRows([{ id: 'w1', table: 'wallets' }])

    const stmts = runTx.mock.calls[0]![0]
    expect(stmts).toHaveLength(2)
    expect(stmts[0]!.sql).toContain('DELETE FROM wallets')
    // Outbox olmadan Faz 5 senkronu bu silmeyi hiç görmez → uzak taraf cüzdanı
    // kalıcı olarak canlı tutar.
    expect(stmts[1]!.sql).toContain('INSERT INTO outbox')
    expect(stmts[1]!.values!).toEqual(expect.arrayContaining(['wallets', 'w1', 'delete']))
  })

  it('çağıranın sırasını korur (referans verenler önce)', async () => {
    await deleteRows([
      { id: 't1', table: 'trns' },
      { id: 'w1', table: 'wallets' }
    ])

    // FK'lar açıldığında cüzdan, ona bakan işlemlerden ÖNCE silinirse ihlal olur.
    const stmts = runTx.mock.calls[0]![0]
    expect(stmts[0]!.sql).toContain('DELETE FROM trns')
    expect(stmts[2]!.sql).toContain('DELETE FROM wallets')
  })

  it('tablo başına tek bildirim yayar', async () => {
    await deleteRows([
      { id: 't1', table: 'trns' },
      { id: 't2', table: 'trns' },
      { id: 't3', table: 'trns' },
      { id: 'w1', table: 'wallets' }
    ])

    // 3 trns silindi ama tabloyu 3 kez yeniden okumanın anlamı yok.
    expect(emitTableChange).toHaveBeenCalledTimes(2)
    expect(emitTableChange).toHaveBeenCalledWith('trns')
    expect(emitTableChange).toHaveBeenCalledWith('wallets')
  })

  it("boş listede DB'ye hiç dokunmaz", async () => {
    await deleteRows([])
    expect(runTx).not.toHaveBeenCalled()
    // Bildirim de yayılmamalı: yayılırsa her ekran boşuna yeniden okur.
    expect(emitTableChange).not.toHaveBeenCalled()
  })

  it('bilinmeyen tabloyu reddeder — hiçbir şey silmeden', async () => {
    await expect(
      deleteRows([
        { id: 't1', table: 'trns' },
        { id: 'x', table: 'secrets' }
      ])
    ).rejects.toThrow(/unknown table/)

    // Doğrulama TÜM listeden önce bitmeli: yoksa geçerli olanlar silinir,
    // sonra patlar — yarım uygulama tam da kaçındığımız şey.
    expect(runTx).not.toHaveBeenCalled()
  })
})
