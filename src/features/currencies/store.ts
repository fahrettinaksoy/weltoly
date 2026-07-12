import { defineStore } from 'pinia'

import { rowToRates, watchTable, type Row, type WatchHandle } from '@/services/db'

import type { Rates } from '@/features/currencies/types'
import { useUserStore } from '@/features/user/store'

export const useCurrenciesStore = defineStore('currencies', () => {
  const userStore = useUserStore()

  const base = computed(() => userStore.baseCurrency)
  const rates = ref<Rates>({})

  let watchController: WatchHandle | null = null

  /** En güncel rates satırına abone ol (Faz 4'te kur çekme servisi dolduracak). */
  function initCurrencies(): void {
    watchController?.abort()
    watchController = watchTable<Row>('SELECT * FROM rates ORDER BY date DESC LIMIT 1', [], (rows) => {
      const r = rows[0] ? rowToRates(rows[0]) : null
      if (r)
        rates.value = r
    })
  }

  function setRates(values: Rates) {
    rates.value = values
  }

  return { base, rates, initCurrencies, setRates }
})
