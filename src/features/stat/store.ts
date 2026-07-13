import { defineStore } from 'pinia'

import { getAmountInRate, getTotal } from '@/shared/lib/getTotal'
import { filterTrnsIds } from '@/features/trns/getTrns'
import { rangeForPeriod } from '@/features/date/utils'
import { getParentCategoryIdOrReturnSame } from '@/features/categories/utils'
import { TrnType } from '@/features/trns/types'
import { useTrnsStore } from '@/features/trns/store'
import { useWalletsStore } from '@/features/wallets/store'
import { useCategoriesStore } from '@/features/categories/store'
import { useCurrenciesStore } from '@/features/currencies/store'
import { useSettingsStore } from '@/stores/settings'
import type { Period, Range } from '@/features/date/types'

// Grafikte gösterilecek aralık sayısı (periyoda göre).
const INTERVAL_COUNT: Record<Period, number> = { day: 14, week: 10, month: 6, year: 5 }

export type StatType = 'expense' | 'income'

export type ChartInterval = { range: Range, income: number, expense: number }
export type BreakdownItem = { categoryId: string, amount: number, percent: number }

export const useStatStore = defineStore('stat', () => {
  const trnsStore = useTrnsStore()
  const walletsStore = useWalletsStore()
  const categoriesStore = useCategoriesStore()
  const currenciesStore = useCurrenciesStore()
  const settings = useSettingsStore()

  const period = ref<Period>('month')
  const offset = ref(0) // 0 = güncel, -1 = önceki
  const statType = ref<StatType>('expense')
  const filterWalletIds = ref<string[]>([]) // boş = tüm cüzdanlar
  const filterTagIds = ref<string[]>([]) // boş = tüm etiketler

  function setPeriod(p: Period) {
    period.value = p
    offset.value = 0
  }
  function setStatType(v: StatType) {
    statType.value = v
  }
  function prev() {
    offset.value -= 1
  }
  function next() {
    if (offset.value < 0)
      offset.value += 1
  }

  const currentRange = computed<Range>(() => rangeForPeriod(period.value, offset.value, settings.weekStart))

  const activeWalletIds = computed(() => filterWalletIds.value.length ? filterWalletIds.value : undefined)
  const activeTagIds = computed(() => filterTagIds.value.length ? filterTagIds.value : undefined)

  function totalsForRange(range: Range) {
    const items = trnsStore.items ?? {}
    const walletsIds = activeWalletIds.value
    const ids = filterTrnsIds({ trnsItems: items, dates: range, walletsIds, tagsIds: activeTagIds.value })
    return getTotal({
      baseCurrencyCode: currenciesStore.base,
      rates: currenciesStore.rates,
      trnsItems: items,
      trnsIds: ids,
      walletsIds,
      walletsItems: walletsStore.items ?? {},
    })
  }

  const summary = computed(() => totalsForRange(currentRange.value))

  /** Grafik için son N aralığın gelir/gider toplamları (güncel aralık en sonda). */
  const series = computed<ChartInterval[]>(() => {
    const n = INTERVAL_COUNT[period.value]
    const list: ChartInterval[] = []
    for (let i = offset.value - (n - 1); i <= offset.value; i++) {
      const range = rangeForPeriod(period.value, i, settings.weekStart)
      const totals = totalsForRange(range)
      list.push({ range, income: totals.income, expense: totals.expense })
    }
    return list
  })

  /** Güncel aralık için kök-kategoriye göre kırılım (statType). */
  const breakdown = computed<BreakdownItem[]>(() => {
    const items = trnsStore.items ?? {}
    const range = currentRange.value
    const type = statType.value === 'income' ? TrnType.Income : TrnType.Expense
    const ids = filterTrnsIds({ trnsItems: items, dates: range, trnsTypes: [type], walletsIds: activeWalletIds.value, tagsIds: activeTagIds.value })

    const map = new Map<string, number>()
    for (const id of ids) {
      const trn = items[id]
      if (!trn || trn.type === TrnType.Transfer || trn.categoryId === 'adjustment')
        continue
      const rootId = getParentCategoryIdOrReturnSame(categoriesStore.items, trn.categoryId)
      const wallet = walletsStore.items?.[trn.walletId]
      const amount = getAmountInRate({
        amount: trn.amount,
        baseCurrencyCode: currenciesStore.base,
        currencyCode: wallet?.currency ?? 'USD',
        rates: currenciesStore.rates,
      })
      map.set(rootId, (map.get(rootId) ?? 0) + amount)
    }

    const total = [...map.values()].reduce((s, v) => s + v, 0)
    return [...map.entries()]
      .map(([categoryId, amount]) => ({ categoryId, amount, percent: total ? (amount / total) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount)
  })

  function setFilterWalletIds(ids: string[]) {
    filterWalletIds.value = ids
  }
  function setFilterTagIds(ids: string[]) {
    filterTagIds.value = ids
  }

  return {
    period,
    offset,
    statType,
    filterWalletIds,
    filterTagIds,
    currentRange,
    summary,
    series,
    breakdown,
    setPeriod,
    setStatType,
    setFilterWalletIds,
    setFilterTagIds,
    prev,
    next,
  }
})
