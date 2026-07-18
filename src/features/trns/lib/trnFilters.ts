import type { TrnKind } from '@/features/trns/lib/trnKind'
import { endOfDay, startOfDay } from 'date-fns'

/**
 * İşlem tablosu süzgeci — TEK KAYNAK (Y-5 + O-6).
 *
 * Mantık WalletDetailPage ve TransactionsPage içinde birebir KOPYA olarak
 * yaşıyordu; `trnFilters.test.ts` ise ÜÇÜNCÜ bir kopyayı test ediyordu. Süzgeç
 * hatası SESSİZDİR — tablo yanlış satırları gösterir, ne build ne typecheck fark
 * eder; üç kopyadan biri kayarsa test yeşil kalırdı (yanlış güven).
 *
 * O-6 — KATEGORİ VE ETİKET ARTIK ID İLE SÜZÜLÜR, ADLA DEĞİL:
 * Eskiden `categoryName` / `tagNames` karşılaştırılıyordu. Aynı ada sahip iki
 * kategori (ör. iki farklı üst kategori altında "Diğer") ya da iki etiket varsa,
 * birini süzmek ÖTEKİNİ DE getiriyordu — kullanıcı hiç istemediği satırları
 * görüyor, üstelik hata sessiz kalıyordu. Adlar yalnız GÖSTERİM içindir; kimlik
 * id'dir.
 */

/** Süzgecin ihtiyaç duyduğu alanlar. Sunum alanları (isim/ikon/renk) buraya girmez. */
export interface TrnFilterRow {
  date: number
  kind: TrnKind
  categoryId: string
  desc: string
  tagIds: string[]
  /** İşaretli tutar (gider negatif) — süzgeç MUTLAK değere bakar. */
  amount: number
  /**
   * Satırın dokunduğu cüzdanlar (transfer İKİ taraflı). Yalnız tüm-cüzdanlar
   * tablosunda (TransactionsPage) anlamlı; cüzdan detayında zaten tek cüzdan
   * var, orada verilmez ve `walletIds` süzgeci boş kalır → etkisiz.
   */
  walletIds?: string[]
}

export interface TrnFilters {
  /** Boş = tarih süzgeci yok. 1 eleman = tek gün. */
  dateRange: Date[]
  kinds: TrnKind[]
  walletIds: string[]
  categoryIds: string[]
  /** Açıklamada serbest metin araması. */
  desc: string
  tagIds: string[]
  /** Mutlak değer alt sınırı. null = sınır yok. */
  minAmount: number | null
}

export function emptyTrnFilters(): TrnFilters {
  return {
    dateRange: [],
    kinds: [],
    walletIds: [],
    categoryIds: [],
    desc: '',
    tagIds: [],
    minAmount: null
  }
}

export function hasAnyTrnFilter(f: TrnFilters): boolean {
  return (
    f.dateRange.length > 0 ||
    f.kinds.length > 0 ||
    f.walletIds.length > 0 ||
    f.categoryIds.length > 0 ||
    f.desc.trim() !== '' ||
    f.tagIds.length > 0 ||
    f.minAmount !== null
  )
}

export function applyTrnFilters<T extends TrnFilterRow>(rows: T[], f: TrnFilters): T[] {
  // Tarih sınırlarını döngü DIŞINDA bir kez hesapla (satır başına startOfDay
  // çağırmak büyük tablolarda gereksiz iş).
  let start: number | null = null
  let end: number | null = null
  if (f.dateRange.length) {
    const days = f.dateRange.map((d) => d.getTime()).toSorted((a, b) => a - b)
    // Bitiş GÜNÜNÜN TAMAMI dahil: 00:00 ile kıyaslamak o günün işlemlerini eler.
    start = startOfDay(days[0]!).getTime()
    end = endOfDay(days.at(-1)!).getTime()
  }

  const needle = f.desc.trim().toLocaleLowerCase()

  return rows.filter((r) => {
    if (start !== null && (r.date < start || r.date > end!)) return false
    if (f.kinds.length && !f.kinds.includes(r.kind)) return false
    // Cüzdan: satırın dokunduğu cüzdanlardan biri seçiliyse geçer (transfer iki taraflı).
    if (f.walletIds.length && !r.walletIds?.some((id) => f.walletIds.includes(id))) return false
    // VEYA: seçilenlerden herhangi biri.
    if (f.categoryIds.length && !f.categoryIds.includes(r.categoryId)) return false
    if (needle && !r.desc.toLocaleLowerCase().includes(needle)) return false
    // Etiket: satır seçilenlerden EN AZ BİRİNİ taşımalı — işlem çok etiketlidir.
    if (f.tagIds.length && !r.tagIds.some((id) => f.tagIds.includes(id))) return false
    // Gider negatif tutulur; kullanıcı "şu tutardan büyük hareketler" diyor.
    if (f.minAmount !== null && Math.abs(r.amount) < f.minAmount) return false
    return true
  })
}
