import type { Period, Range } from '@/features/date/types'

import { defineStore } from 'pinia'
import { ADJUSTMENT_ID } from '@/features/categories/pseudoCategories'
import { useCategoriesStore } from '@/features/categories/store'
import { getParentCategoryIdOrReturnSame } from '@/features/categories/utils'
import { useCurrenciesStore } from '@/features/currencies/store'
import { rangeForPeriod } from '@/features/date/utils'
import { filterTrnsIds } from '@/features/trns/getTrns'
import { useTrnsStore } from '@/features/trns/store'
import { TrnType } from '@/features/trns/types'
import { useWalletsStore } from '@/features/wallets/store'
import { getAmountInRate, getTotal } from '@/shared/lib/getTotal'
import { addMoney } from '@/shared/lib/money'
import { useSettingsStore } from '@/stores/settings'

// Grafikte gösterilecek aralık sayısı (periyoda göre).
const INTERVAL_COUNT: Record<Period, number> = { day: 14, week: 10, month: 6, year: 5 }

export type StatType = 'expense' | 'income'

export interface ChartInterval { range: Range, income: number, expense: number }
export interface BreakdownItem {
  categoryId: string
  amount: number
  percent: number
  /** Kök inilebilir mi — altında bu aralıkta birden çok yaprak var mı. */
  canDrill: boolean
}
export interface TagBreakdownItem { tagId: string, amount: number, percent: number }

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
  /** Kırılımda inilen kök kategori. null = üst seviye. */
  const drillRoot = ref<string | null>(null)

  /**
   * İniş, altındaki veri her değiştiğinde sıfırlanır: seçili kök yeni aralıkta /
   * yeni süzgeçte hiç harcama taşımayabilir, kullanıcı boş bir kırılımda kilitli
   * kalırdı. (statType de dahil: "Gider → Market" içindeyken Gelir'e geçmek
   * anlamsız bir iniş bırakırdı.)
   */
  function resetDrill() {
    drillRoot.value = null
  }

  function setPeriod(p: Period) {
    period.value = p
    offset.value = 0
    resetDrill()
  }
  function setStatType(v: StatType) {
    statType.value = v
    resetDrill()
  }
  function setDrillRoot(id: string | null) {
    drillRoot.value = id
  }
  function prev() {
    offset.value -= 1
    resetDrill()
  }
  function next() {
    if (offset.value < 0)
      offset.value += 1
    resetDrill()
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

  /**
       Aralıktaki işlem adedi. Gelir/gider tanımıyla AYNI küme: transfer ve
      düzeltme hariç — yoksa "12 işlem" derken toplamlara girmeyenleri sayardı.
   */
  function countForRange(range: Range) {
    const items = trnsStore.items ?? {}
    const ids = filterTrnsIds({ trnsItems: items, dates: range, walletsIds: activeWalletIds.value, tagsIds: activeTagIds.value })
    let n = 0
    for (const id of ids) {
      const trn = items[id]
      if (trn && trn.type !== TrnType.Transfer && trn.categoryId !== ADJUSTMENT_ID)
        n++
    }
    return n
  }

  const summary = computed(() => ({ ...totalsForRange(currentRange.value), count: countForRange(currentRange.value) }))

  /**
   * Bir ÖNCEKİ aynı uzunluktaki aralık — kıyas için.
   * Neden: "₺23.830 gider" tek başına çok mu az mı söylemiyor; sayaçlar
   * referanssızdı. Aralık zaten offset ile modellendiği için "önceki" = offset−1;
   * ay/yıl gibi eşit olmayan uzunluklarda bile doğru takvim aralığını verir
   * (gün sayısı çıkarmak Şubat'ta yanlış olurdu).
   */
  const prevRange = computed<Range>(() => rangeForPeriod(period.value, offset.value - 1, settings.weekStart))
  const prevSummary = computed(() => ({ ...totalsForRange(prevRange.value), count: countForRange(prevRange.value) }))

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

  /**
   * Güncel aralık + süzgeçlere uyan işlemler, tutarları TEMEL para biriminde.
   * Kategori ve etiket kırılımlarının ortak kaynağı — ikisi de aynı kümeyi ve
   * aynı kur dönüşümünü kullansın diye tek yerde (ayrı ayrı hesaplanınca
   * sessizce farklı toplamlar verebilirlerdi).
   */
  const typedTrns = computed(() => {
    const items = trnsStore.items ?? {}
    const type = statType.value === 'income' ? TrnType.Income : TrnType.Expense
    const ids = filterTrnsIds({ trnsItems: items, dates: currentRange.value, trnsTypes: [type], walletsIds: activeWalletIds.value, tagsIds: activeTagIds.value })

    const out: { categoryId: string, tagIds: string[], amount: number }[] = []
    for (const id of ids) {
      const trn = items[id]
      if (!trn || trn.type === TrnType.Transfer || trn.categoryId === ADJUSTMENT_ID)
        continue
      const wallet = walletsStore.items?.[trn.walletId]
      const amount = getAmountInRate({
        amount: trn.amount,
        baseCurrencyCode: currenciesStore.base,
        currencyCode: wallet?.currency ?? 'USD',
        rates: currenciesStore.rates,
      })
      // Kur eksikse (null) istatistiğe sokma — sessiz 1:1 varsayma (Y-1).
      if (amount === null)
        continue
      out.push({
        categoryId: trn.categoryId,
        tagIds: trn.tagIds ?? [],
        amount,
      })
    }
    return out
  })

  /** Yaprak kategori → tutar. İşlem her zaman yaprağa yazılır. */
  const amountsByLeaf = computed(() => {
    const map = new Map<string, number>()
    for (const t of typedTrns.value)
      map.set(t.categoryId, addMoney(map.get(t.categoryId) ?? 0, t.amount))
    return map
  })

  /** Kök → altındaki yapraklar (yalnız bu aralıkta hareketi olanlar). */
  const leavesByRoot = computed(() => {
    const map = new Map<string, string[]>()
    for (const leaf of amountsByLeaf.value.keys()) {
      const root = getParentCategoryIdOrReturnSame(categoriesStore.items, leaf)
      const list = map.get(root)
      if (list)
        list.push(leaf)
      else map.set(root, [leaf])
    }
    return map
  })

  /**
   * Güncel aralık için kategori kırılımı (statType).
   * Üst seviyede KÖKE toplanır (okunur kalsın), inilince o kökün yaprakları.
   */
  const breakdown = computed<BreakdownItem[]>(() => {
    const map = new Map<string, number>()
    if (drillRoot.value) {
      for (const leaf of leavesByRoot.value.get(drillRoot.value) ?? [])
        map.set(leaf, amountsByLeaf.value.get(leaf)!)
    }
    else {
      for (const [leaf, amount] of amountsByLeaf.value) {
        const root = getParentCategoryIdOrReturnSame(categoriesStore.items, leaf)
        map.set(root, (map.get(root) ?? 0) + amount)
      }
    }

    const total = [...map.values()].reduce((s, v) => s + v, 0)
    return [...map.entries()]
      .map(([categoryId, amount]) => ({
        categoryId,
        amount,
        percent: total ? (amount / total) * 100 : 0,
        // Tek yapraklı kök inilmez: aynı tutar, aynı isim — tıklamak hiçbir şey
        // değiştirmez, tıklanabilir göstermek yalan olur.
        canDrill: !drillRoot.value && (leavesByRoot.value.get(categoryId)?.length ?? 0) > 1,
      }))
      .sort((a, b) => b.amount - a.amount)
  })

  /** Kırılımda gösterilen toplam (inilmişse o kökün toplamı). */
  const breakdownTotal = computed(() => breakdown.value.reduce((s, r) => s + r.amount, 0))

  /**
   * Etiket kırılımı.
   *
   * Oranların paydası ARALIĞIN TOPLAMI, etiket toplamları değil — ve oranların
   * toplamı %100 ETMEZ. Sebebi: etiket çoklu seçim, bir işlem hem "Zorunlu" hem
   * "Aylık" olabilir, dolayısıyla etiket toplamları birbiriyle çakışır ve toplamı
   * gerçek gideri aşar. Payda etiket toplamı yapılsaydı her yüzde sessizce
   * yanlışa dönerdi (ekranda yine makul görünürlerdi).
   * Bu yüzden ekranda pasta değil bağımsız çubuklar kullanılıyor.
   */
  const tagBreakdown = computed<TagBreakdownItem[]>(() => {
    const sums = new Map<string, number>()
    let untagged = 0
    let total = 0
    for (const t of typedTrns.value) {
      total += t.amount
      if (!t.tagIds.length) {
        untagged += t.amount
        continue
      }
      for (const id of t.tagIds)
        sums.set(id, (sums.get(id) ?? 0) + t.amount)
    }

    const rows = [...sums.entries()]
      .map(([tagId, amount]) => ({ tagId, amount, percent: total ? (amount / total) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount)

    // Etiketsiz tutar hiçbir çubukta görünmez → sessizce kaybolurdu.
    if (untagged > 0)
      rows.push({ tagId: '__untagged', amount: untagged, percent: total ? (untagged / total) * 100 : 0 })
    return rows
  })

  function setFilterWalletIds(ids: string[]) {
    filterWalletIds.value = ids
    resetDrill()
  }
  function setFilterTagIds(ids: string[]) {
    filterTagIds.value = ids
    resetDrill()
  }
  function clearFilters() {
    filterWalletIds.value = []
    filterTagIds.value = []
    resetDrill()
  }
  const hasFilter = computed(() => filterWalletIds.value.length > 0 || filterTagIds.value.length > 0)

  return {
    period,
    offset,
    statType,
    filterWalletIds,
    filterTagIds,
    drillRoot,
    currentRange,
    prevRange,
    summary,
    prevSummary,
    series,
    breakdown,
    breakdownTotal,
    tagBreakdown,
    hasFilter,
    setPeriod,
    setStatType,
    setDrillRoot,
    setFilterWalletIds,
    setFilterTagIds,
    clearFilters,
    prev,
    next,
  }
})
