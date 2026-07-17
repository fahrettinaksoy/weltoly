import type { Rates } from '@/features/currencies/types'

import type { Row, WatchHandle } from '@/services/db'

import { defineStore } from 'pinia'
import { useUserStore } from '@/features/user/store'
import { rowToRates, watchTable } from '@/services/db'

export const useCurrenciesStore = defineStore('currencies', () => {
  const userStore = useUserStore()

  const base = computed(() => userStore.baseCurrency)
  const rates = ref<Rates>({})

  let watchController: WatchHandle | null = null

  /** En güncel rates satırına abone ol (Faz 4'te kur çekme servisi dolduracak). */
  function initCurrencies(): void {
    watchController?.abort()
    watchController = watchTable<Row>(['rates'], 'SELECT * FROM rates ORDER BY date DESC LIMIT 1', [], (rows) => {
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
