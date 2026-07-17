import type { Rates } from '@/features/currencies/types'

import type { Row, WatchHandle } from '@/services/db'

import { defineStore } from 'pinia'
import { useUserStore } from '@/features/user/store'
import { isTauriRuntime, rowToRates, watchTable } from '@/services/db'

/** Kayıtlı kur setinin künyesi — "kurlar güncel mi" sorusunu yanıtlar. */
export interface RatesMeta {
  /** Kurları BİZİM çektiğimiz gün (satırın id'si), yyyy-MM-dd. */
  date: string
  /**
   * KAYNAĞIN kendi kur tarihi. `date` ile aynı olmak zorunda DEĞİL: ECB/TCMB iş
   * günü sonunda yayımlar, hafta sonu güncellemez → 17'sinde çekilen kur 16'sı
   * tarihli olabilir. null = kaynak tarih vermiyor (006 öncesi satır).
   */
  rateDate: string | null
  /** 'frankfurter+coingecko' gibi. null = eski satır. */
  source: string | null
  /** Çekme anı (ms). */
  updatedAt: number | null
}

export const useCurrenciesStore = defineStore('currencies', () => {
  const userStore = useUserStore()

  const base = computed(() => userStore.baseCurrency)
  const rates = ref<Rates>({})
  /**
   * Kur setinin künyesi. null = henüz hiç kur çekilmemiş.
   * Ayrı tutulur çünkü `rowToRates` yalnız sözlüğü döndürür; kaynak/tarih
   * kolonları DB'de vardı ama hiç okunmuyordu — güncellik ekranı bunlara dayanır.
   */
  const meta = ref<RatesMeta | null>(null)

  /** İlk DB okuması döndü mü (skeleton/boş-durum ayrımı için). */
  const isLoaded = ref(!isTauriRuntime())

  let watchController: WatchHandle | null = null

  /** En güncel rates satırına abone ol. */
  function initCurrencies(): void {
    watchController?.abort()
    watchController = watchTable<Row>(['rates'], 'SELECT * FROM rates ORDER BY date DESC LIMIT 1', [], (rows) => {
      isLoaded.value = true
      const row = rows[0]
      if (!row) {
        meta.value = null
        return
      }
      const r = rowToRates(row)
      if (r)
        rates.value = r
      meta.value = {
        date: String(row.date),
        rateDate: (row.rateDate as string | null) ?? null,
        source: (row.source as string | null) ?? null,
        updatedAt: row.updatedAt != null ? Number(row.updatedAt) : null,
      }
    })
  }

  function setRates(values: Rates) {
    rates.value = values
  }

  return { base, rates, meta, isLoaded, initCurrencies, setRates }
})
