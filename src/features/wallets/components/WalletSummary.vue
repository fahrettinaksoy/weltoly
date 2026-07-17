<script setup lang="ts">
import type { TrnId, TrnItem } from '@/features/trns/types'
import type { TagBreakdownInput } from '@/features/wallets/lib/tagBreakdown'
import type { WalletItemComputed } from '@/features/wallets/types'

import { useI18n } from 'vue-i18n'
import AppEmptyState from '@/components/AppEmptyState.vue'
import SectionCard from '@/components/SectionCard.vue'
import { ADJUSTMENT_ID } from '@/features/categories/pseudoCategories'
import { useCategoriesStore } from '@/features/categories/store'
import { getParentCategoryIdOrReturnSame } from '@/features/categories/utils'
import { useCurrenciesStore } from '@/features/currencies/store'
import { changeRatio, deltaTone } from '@/features/stat/lib/periodCompare'
import { useTagsStore } from '@/features/tags/store'
import { TrnType } from '@/features/trns/types'
import WalletBalanceChart from '@/features/wallets/components/WalletBalanceChart.vue'
import { toBaseAmount } from '@/features/wallets/lib/baseAmount'
import { buildTagBreakdown, UNTAGGED_KEY } from '@/features/wallets/lib/tagBreakdown'

/**
 * Cüzdanın ÖZET sekmesi: bakiye şeridi, sayaçlar, bakiye seyri, kategori ve
 * etiket dağılımları, dönem rayı (Y-7).
 *
 * WalletDetailPage'den ayrıldı — o dosya tek başına iki tam özellik (Özet +
 * İşlemler) barındırıyor ve 1265 satırdı. Dönem SEÇİMİ burada yaşar (ray burada)
 * ama dönemin TÜRETTİKLERİ (periodTrns/prevPeriodTrns) sayfada hesaplanır:
 * İşlemler sekmesi de aynı listeye ihtiyaç duyuyor, iki yerde hesaplamak
 * sessizce ayrışmaya açık olurdu.
 */
const props = defineProps<{
  wallet: WalletItemComputed
  walletId: string
  /** Tüm işlemler (dönemden bağımsız) — "son hareket" için. */
  allTrns: { id: TrnId, trn: TrnItem }[]
  /** Seçili dönemin işlemleri. */
  periodTrns: { id: TrnId, trn: TrnItem }[]
  /** Bir önceki eş uzunluktaki dönem; 'all' seçiliyken null (kıyas yok). */
  prevPeriodTrns: { id: TrnId, trn: TrnItem }[] | null
  isDefault: boolean
}>()

/** Dönem seçimi rayda yapılır → sayfaya v-model ile geri bildirilir. */
const period = defineModel<'30' | '90' | '365' | 'all'>('period', { required: true })

const { t } = useI18n()
const categoriesStore = useCategoriesStore()
const tagsStore = useTagsStore()
const currenciesStore = useCurrenciesStore()
const fmt = useFormat()

const periodOptions = computed(() => [
  { value: '30' as const, label: t('walletDetail.days', { n: 30 }) },
  { value: '90' as const, label: t('walletDetail.days', { n: 90 }) },
  { value: '365' as const, label: t('walletDetail.days', { n: 365 }) },
  { value: 'all' as const, label: t('walletDetail.allTime') },
])

/** Durum çipleri: yalnız geçerli olanlar. Şablonda dört ayrı v-if okunmuyordu. */
const statusChips = computed(() => {
  const w = props.wallet
  if (!w)
    return []
  return [
    props.isDefault && { label: t('wallets.default'), icon: 'mdi-star', color: 'warning' },
    w.isArchived && { label: t('wallets.archived'), icon: 'mdi-archive-outline', color: undefined },
    w.isExcludeInTotal && { label: t('wallets.excludeInTotal'), icon: 'mdi-calculator-variant-outline', color: 'warning' },
    w.isWithdrawal && { label: t('wallets.withdrawal'), icon: 'mdi-cash-fast', color: 'success' },
  ].filter((c): c is { label: string, icon: string, color: string | undefined } => !!c)
})

/** En son hareket. allTrns yeniden eskiye sıralı → ilk eleman. */
const lastTrnDate = computed(() => props.allTrns[0]?.trn.date ?? null)

// --- Sayaçlar -----------------------------------------------------------
/**
 * Dönem içi gelir/gider. Transfer ve düzeltme HARİÇ — bunlar gelir/gider değil
 * (finapp kuralı, shared/lib/getTotal.ts ile aynı). Cüzdanlar sayfasındaki
 * sütunlarla aynı tanım, yoksa aynı veri iki farklı rakam verirdi.
 */
function flowOf(trns: { trn: TrnItem }[]) {
  let income = 0
  let expense = 0
  let count = 0
  for (const { trn } of trns) {
    count++
    if (trn.type === TrnType.Transfer || trn.categoryId === ADJUSTMENT_ID)
      continue
    if (trn.type === TrnType.Income)
      income += trn.amount
    else
      expense += trn.amount
  }
  return { income, expense, net: income - expense, count }
}

const flow = computed(() => flowOf(props.periodTrns))

const prevFlow = computed(() => (props.prevPeriodTrns ? flowOf(props.prevPeriodTrns) : null))

/**
 * Sayaç kartları. `positiveIsGood` şart: gider ARTIŞI kötüdür ama gelir artışı
 * iyidir — ikisini de aynı renkle boyamak kullanıcıyı yanıltırdı.
 * Net'te oran kullanılmaz: net işaret değiştirebilir (−5.000 → +3.000) ve orada
 * yüzde saçmalar; mutlak fark okunur.
 */
const factCards = computed(() => {
  const p = prevFlow.value
  return [
    { key: 'income', label: t('trnForm.income'), value: flow.value.income, money: true, tone: 'text-success', delta: p ? changeRatio(flow.value.income, p.income) : null, positiveIsGood: true },
    { key: 'expense', label: t('trnForm.expense'), value: flow.value.expense, money: true, tone: 'text-error', delta: p ? changeRatio(flow.value.expense, p.expense) : null, positiveIsGood: false },
    { key: 'net', label: t('walletDetail.net'), value: flow.value.net, money: true, tone: flow.value.net >= 0 ? '' : 'text-error', delta: null, positiveIsGood: true },
    { key: 'count', label: t('wallets.table.trnCount'), value: flow.value.count, money: false, tone: '', delta: p ? changeRatio(flow.value.count, p.count) : null, positiveIsGood: true },
  ]
})

/**
 * Temel para birimi karşılığı — cüzdan farklı bir birimdeyse gösterilir.
 * null = gösterme (aynı birim YA DA kur eksik).
 *
 * Kur eksikken `?? 1` ile 1:1 varsaymak Y-1 politikasını deliyordu: 3,15 ETH
 * "≈ 3,15 $" diye yazılıyordu. Üstelik Panel'deki net varlık o cüzdanı zaten
 * hariç tutuyor → aynı veri iki ekranda çelişiyordu. Kur yoksa uydurma yok,
 * satır hiç çizilmez.
 */
const baseEquivalent = computed(() => {
  const w = props.wallet
  if (!w || w.currency === currenciesStore.base)
    return null
  return toBaseAmount(w.amount, w.rate) // kur eksikse null → satır çizilmez
})

// --- Kredi kartı limiti -------------------------------------------------
/**
 * Kredi kartında bakiye NEGATİFTİR (borç). Kullanılan limit = borcun mutlak değeri.
 * Bakiye pozitifse (fazla ödeme) kullanım 0 kabul edilir — negatif kullanım anlamsız.
 */
const credit = computed(() => {
  const w = props.wallet
  if (!w || w.type !== 'credit')
    return null
  const limit = w.creditLimit ?? 0
  const used = Math.max(0, -w.amount)
  return {
    limit,
    used,
    available: Math.max(0, limit - used),
    ratio: limit > 0 ? Math.min(100, (used / limit) * 100) : 0,
  }
})

// --- Kategori dağılımı (yalnız giderler) --------------------------------
const PIE_LIMIT = 6

/**
 * İşlemin kategorisini KÖKÜNE toplar. İşlem her zaman yaprağa yazılır.
 *
 * Neden gerekli: pasta yapraklarla çizilince kırılım fazla ufalanıyordu —
 * ölçüldü, örnek bir vadesiz hesapta 13 yaprak çıkıyor, ilk 6 dışındakiler tek
 * bir gri "Diğer (7)" diliminde toplanıp %20,1 tutuyordu; yani en büyük dilimle
 * (Araç Sigorta, %20,1) başabaş. En büyük dilimin adı "Diğer" olan bir pasta
 * hiçbir soruyu yanıtlamaz. Köke toplanınca aynı veri 6 dilime iniyor, "Diğer"
 * tamamen kayboluyor.
 *
 * Tek seviye yukarı çıkmak YETER: ağaç yapısal olarak 2 seviye — kategori formu
 * üst kategori olarak yalnız `categoriesRootIds` sunuyor, yani bir çocuk başka
 * bir çocuğun altına giremiyor (ölçüldü: 18 kök, 69 çocuk, derinlik 1).
 * Bu yüzden özyineleme değil, kod tabanının mevcut yardımcısı.
 */
function rootCategoryId(id: string): string {
  return getParentCategoryIdOrReturnSame(categoriesStore.items, id)
}

/** Dönem içi giderin YAPRAK kategori bazında toplamı — tüm kırılımların kaynağı. */
const expenseByLeaf = computed(() => {
  const sums = new Map<string, number>()
  for (const { trn } of props.periodTrns) {
    if (trn.type !== TrnType.Expense || trn.categoryId === ADJUSTMENT_ID)
      continue
    sums.set(trn.categoryId, (sums.get(trn.categoryId) ?? 0) + trn.amount)
  }
  return sums
})

/** Kök → altındaki yapraklar (yalnız bu dönemde harcaması olanlar). */
const leavesByRoot = computed(() => {
  const map = new Map<string, string[]>()
  for (const leaf of expenseByLeaf.value.keys()) {
    const root = rootCategoryId(leaf)
    const list = map.get(root)
    if (list)
      list.push(leaf)
    else map.set(root, [leaf])
  }
  return map
})

/**
 * Pastada inilen kök. null = üst seviye (kökler).
 * Detay kaybolmasın diye: köke toplamak okunurluğu kazandırıyor ama "Faturalar
 * 8.025" tek başına elektrik mi doğalgaz mı söylemiyor — tıklayınca o kökün
 * yaprakları gösteriliyor.
 */
const drillRoot = ref<string | null>(null)

/**
     Dönem/cüzdan değişince iniş sıfırlanır: seçili kökün yeni dönemde hiç
    harcaması olmayabilir, kullanıcı boş bir pastada kilitli kalırdı.
 */
watch([period, toRef(props, 'walletId')], () => {
  drillRoot.value = null
})

function pieRow(id: string, value: number) {
  return {
    key: id,
    title: categoriesStore.items[id]?.name ?? id,
    color: categoriesStore.items[id]?.color || 'grey',
    value,
    // Tek yapraklı kök inilmez: aynı tutar, aynı isim — tıklamak hiçbir şey
    // değiştirmez, tıklanabilir göstermek yalan olur.
    canDrill: !drillRoot.value && (leavesByRoot.value.get(id)?.length ?? 0) > 1,
  }
}

const categoryBreakdown = computed(() => {
  const sums = new Map<string, number>()
  if (drillRoot.value) {
    for (const leaf of leavesByRoot.value.get(drillRoot.value) ?? [])
      sums.set(leaf, expenseByLeaf.value.get(leaf)!)
  }
  else {
    for (const [leaf, value] of expenseByLeaf.value)
      sums.set(rootCategoryId(leaf), (sums.get(rootCategoryId(leaf)) ?? 0) + value)
  }

  const rows = [...sums.entries()]
    .map(([id, value]) => pieRow(id, value))
    .toSorted((a, b) => b.value - a.value)

  // Köke toplandıktan sonra "Diğer" nadiren oluşur (kök sayısı az), ama tek bir
  // kökün altında 6'dan fazla yaprak olabilir → güvenlik ağı olarak duruyor.
  const top = rows.slice(0, PIE_LIMIT)
  const restValue = rows.slice(PIE_LIMIT).reduce((sum, r) => sum + r.value, 0)
  if (restValue > 0) {
    top.push({
      key: '__rest',
      title: t('walletDetail.otherCategories', { count: rows.length - PIE_LIMIT }),
      color: 'grey',
      value: restValue,
      canDrill: false,
    })
  }
  return top
})

const drillTitle = computed(() =>
  drillRoot.value ? categoriesStore.items[drillRoot.value]?.name ?? '' : '',
)

/** Pastada GÖSTERİLEN toplam — inildiğinde o kökün toplamı (donut merkezi). */
const totalExpense = computed(() => categoryBreakdown.value.reduce((s, r) => s + r.value, 0))

/** Dönemin TÜM gideri — inişten etkilenmez. Etiket oranlarının paydası. */
const periodExpenseTotal = computed(() =>
  [...expenseByLeaf.value.values()].reduce((s, v) => s + v, 0),
)

// --- Etiket dağılımı ----------------------------------------------------
const TAG_LIMIT = 8
/**
 * Giderin etiketlere dağılımı.
 *
 * PASTA DEĞİL, ÇUBUK — ve bu bir üslup tercihi değil, zorunluluk: etiket çoklu
 * seçim, bir işlem hem "Zorunlu" hem "Aylık" hem "Aile" olabilir. Ölçüldü:
 * örnek bir hesapta etiket toplamları giderin %237'si. Pasta bunları %100'e
 * normalize ederdi ve HER yüzde yanlış çıkardı — Zorunlu gerçekte giderin
 * %66'sıyken pastada %28 görünürdü.
 *
 * Bu yüzden her çubuk BAĞIMSIZ olarak dönemin toplam giderine oranlanır;
 * çubukların toplamı %100 etmez, etmesi de beklenmez. Kategori pastasının
 * yanıtlamadığı soruyu yanıtlar: para ne için değil, hangi BAĞLAMDA gitti.
 */
const tagBreakdown = computed(() => {
  // Hesap features/wallets/lib/tagBreakdown.ts'te — TEK KAYNAK (Y-5); test de
  // aynı modülü import eder. Burada YALNIZ sunum (başlık/renk) giydirilir.
  const expenses: TagBreakdownInput[] = []
  for (const { trn } of props.periodTrns) {
    // Erken-continue ile daraltma: TrnItem bir birlik tipi, transfer dalında
    // `amount` alanı yok — .filter() TS'i daraltmaz, bu döngü daraltır.
    if (trn.type !== TrnType.Expense || trn.categoryId === ADJUSTMENT_ID)
      continue
    expenses.push({ amount: trn.amount, tagIds: trn.tagIds })
  }

  return buildTagBreakdown(expenses, periodExpenseTotal.value, TAG_LIMIT)
    .map(row => ({
      ...row,
      title: row.key === UNTAGGED_KEY
        ? t('walletDetail.untagged')
        : tagsStore.items[row.key]?.name ?? row.key,
      color: row.key === UNTAGGED_KEY
        ? 'grey'
        : tagsStore.items[row.key]?.color || 'grey',
    }))
})
</script>

<template>
  <div>
    <!-- Bakiye şeridi: TEK satır, hücreler genişliği eşit paylaşır (flex: 1 1 0).
     Önce dikey bir bakiye bloğu + yanına birkaç öğe vardı; blok 4 satır
     yüksekliğindeydi ve yanındakiler genişliği dolduramıyordu — boşluk
     v-spacer'la ortada, spacer'sız sağda kalıyordu. Sorun hizalama değil
     yapıydı: doldurulacak kadar hücre yoktu. Açıklama ve durum da artık
     birer hücre; boşluk kalmıyor ve hepsi bilgi taşıyor. -->
    <v-sheet color="surface-light" class="d-flex align-center flex-wrap ga-4 pa-4 mb-4">
      <div class="wallet-fact wallet-fact--main">
        <div class="text-caption text-medium-emphasis">
          {{ t('wallets.table.balance') }}
        </div>
        <div class="d-flex align-baseline ga-2 flex-wrap">
          <span
            class="text-h5 font-weight-bold"
            :class="{ 'text-error': wallet.amount < 0 }"
          >{{ fmt.money(wallet.amount, wallet.currency) }}</span>
          <!-- Karşılık AYNI satırda: alt satıra alınca blok uzuyor ve şerit
           tek satırlık olmaktan çıkıyordu. Yalnız farklı para biriminde. -->
          <span v-if="baseEquivalent !== null" class="text-caption text-medium-emphasis">
            ≈ {{ fmt.money(baseEquivalent, currenciesStore.base) }}
          </span>
        </div>
      </div>

      <div class="wallet-fact">
        <div class="text-caption text-medium-emphasis">
          {{ t('walletDetail.lastTrn') }}
        </div>
        <div class="text-subtitle-1 font-weight-medium text-truncate">
          {{ lastTrnDate ? fmt.date(lastTrnDate) : '—' }}
        </div>
      </div>

      <!-- Dönemden BAĞIMSIZ toplam; süzgeçli adet aşağıdaki sayaçta. -->
      <div class="wallet-fact">
        <div class="text-caption text-medium-emphasis">
          {{ t('walletDetail.totalTrns') }}
        </div>
        <div class="text-subtitle-1 font-weight-medium">
          {{ fmt.number(allTrns.length) }}
        </div>
      </div>

      <!-- Kullanılabilir limit yalnız kredi kartında anlamlı. -->
      <div v-if="credit" class="wallet-fact">
        <div class="text-caption text-medium-emphasis">
          {{ t('walletDetail.available') }}
        </div>
        <div class="text-subtitle-1 font-weight-medium text-truncate">
          {{ fmt.money(credit.available, wallet.currency) }}
        </div>
      </div>

      <div v-if="wallet.desc" class="wallet-fact wallet-fact--desc">
        <div class="text-caption text-medium-emphasis">
          {{ t('wallets.description') }}
        </div>
        <div class="text-body-2 text-truncate" :title="wallet.desc">
          {{ wallet.desc }}
        </div>
      </div>

      <div v-if="statusChips.length" class="wallet-fact">
        <div class="text-caption text-medium-emphasis">
          {{ t('walletDetail.status') }}
        </div>
        <div class="d-flex ga-1 flex-wrap">
          <v-chip
            v-for="chip in statusChips"
            :key="chip.label"
            :color="chip.color"
            :prepend-icon="chip.icon"
            variant="tonal"
            size="small"
          >
            {{ chip.label }}
          </v-chip>
        </div>
      </div>
    </v-sheet>

    <!-- Kredi kartı: limit kullanımı. Yalnız credit türünde anlamlı. -->
    <v-sheet v-if="credit" color="surface-light" class="pa-5 mb-4">
      <div class="d-flex align-center justify-space-between mb-2 flex-wrap ga-2">
        <span class="text-subtitle-2 font-weight-bold">{{ t('walletDetail.creditUsage') }}</span>
        <span class="text-body-2">
          {{ fmt.money(credit.used, wallet.currency) }} / {{ fmt.money(credit.limit, wallet.currency) }}
        </span>
      </div>
      <v-progress-linear
        :model-value="credit.ratio"
        :color="credit.ratio > 80 ? 'error' : credit.ratio > 50 ? 'warning' : 'success'"
        height="10"
        rounded
      />
      <div class="d-flex justify-space-between mt-2">
        <span class="text-caption text-medium-emphasis">
          {{ t('walletDetail.available') }}: {{ fmt.money(credit.available, wallet.currency) }}
        </span>
        <span class="text-caption font-weight-medium">{{ fmt.percent(credit.ratio) }}</span>
      </div>
    </v-sheet>

    <!-- Dönem sayaçları — her biri önceki AYNI UZUNLUKTAKİ dönemle kıyaslı. -->
    <div class="d-flex ga-3 mb-4 flex-wrap">
      <v-sheet
        v-for="card in factCards"
        :key="card.key"
        color="surface-light"
        class="pa-4 flex-1-1 wallet-kpi"
      >
        <div class="d-flex align-center ga-2">
          <div class="text-h5 font-weight-bold text-truncate" :class="card.tone">
            {{ card.money ? fmt.money(card.value, wallet.currency) : fmt.number(card.value) }}
          </div>
          <!-- Rozet yalnız kıyas MÜMKÜNSE: 'Tümü' döneminde öncesi yok,
           önceki dönem 0 ise yüzde tanımsız (changeRatio → null). -->
          <v-chip
            v-if="card.delta !== null"
            :color="deltaTone(card.delta, card.positiveIsGood)"
            :prepend-icon="card.delta >= 0 ? 'mdi-arrow-up' : 'mdi-arrow-down'"
            size="x-small"
            variant="tonal"
            :title="t('walletDetail.vsPrevPeriod')"
          >
            {{ fmt.percent(Math.abs(card.delta)) }}
          </v-chip>
        </div>
        <div class="text-caption text-medium-emphasis">
          {{ card.label }}
        </div>
      </v-sheet>
    </div>

    <!-- Üç kart TEK satırda ve EŞİT yükseklikte (flex varsayılanı: stretch).
     Yüksekliği doğal içeriği olan kategori kartı belirler; bakiye seyri
     grafiği kalan alana yayılır, dönem kartı da aynı boya uzar.
     Dönem daha önce dış sarmalayıcıdaydı (sayaçların da yanında) — orada
     kategoriyle aynı satırda olmadığı için yüksekliği eşleşemiyordu. -->
    <div class="d-flex ga-4 mb-4 flex-wrap align-stretch">
      <div class="wallet-col wallet-col--trend">
        <SectionCard
          :title="t('walletDetail.balanceTrend')"
          :subtitle="t('walletDetail.balanceTrendDesc')"
          icon="mdi-chart-line"
        >
          <WalletBalanceChart
            :trns="periodTrns"
            :wallet-id="walletId"
            :current-balance="wallet.amount"
            :currency="wallet.currency"
          />
        </SectionCard>
      </div>

      <div class="wallet-col wallet-col--cat">
        <SectionCard
          :title="drillRoot ? drillTitle : t('walletDetail.byCategory')"
          :subtitle="drillRoot ? t('walletDetail.byCategoryDrillDesc') : t('walletDetail.byCategoryDesc')"
          icon="mdi-chart-donut"
        >
          <!-- İnildiyse çıkış yolu her zaman görünür olmalı; yoksa kullanıcı
           alt kırılımda kalır ve üst seviyeye dönemez. -->
          <template #actions>
            <v-btn
              v-if="drillRoot"
              :text="t('walletDetail.allCategories')"
              prepend-icon="mdi-arrow-left"
              variant="text"
              size="small"
              @click="drillRoot = null"
            />
          </template>

          <AppEmptyState
            v-if="!categoryBreakdown.length"
            density="compact"
            icon="mdi-chart-donut"
            :title="t('walletDetail.noExpense')"
          />

          <div v-else class="d-flex align-center ga-5 flex-wrap">
            <v-pie :items="categoryBreakdown" :size="150" :inner-cut="64" :gap="2" rounded="2" tooltip>
              <template #center>
                <div class="text-caption font-weight-bold">
                  {{ fmt.money(totalExpense, wallet.currency) }}
                </div>
              </template>
            </v-pie>

            <!-- Legend: donut küçük, tablo yok → adı ve tutarı burada okumak gerek.
             Aynı zamanda inişin TIKLAMA YÜZEYİ: VPie'ın tıklama olayı yok
             (kaynağında emit yok), zaten okunan yüzey de burası. -->
            <div class="flex-1-1 wallet-legend">
              <component
                :is="c.canDrill ? 'button' : 'div'"
                v-for="c in categoryBreakdown"
                :key="String(c.key)"
                class="d-flex align-center ga-2 mb-1 wallet-legend-row"
                :class="c.canDrill && 'wallet-legend-row--drill'"
                :type="c.canDrill ? 'button' : undefined"
                :title="c.canDrill ? t('walletDetail.drillHint', { name: c.title }) : undefined"
                @click="c.canDrill && (drillRoot = String(c.key))"
              >
                <v-avatar :color="c.color" size="10" />
                <span class="text-caption text-truncate flex-1-1 text-start">{{ c.title }}</span>
                <span class="text-caption text-medium-emphasis">
                  {{ fmt.money(c.value, wallet.currency) }}
                </span>
                <!-- Yer her satırda ayrılır (visibility), yoksa inilebilen ve
                 inilemeyen satırların tutarları farklı hizalanırdı. -->
                <v-icon
                  icon="mdi-chevron-right"
                  size="14"
                  class="text-medium-emphasis"
                  :style="{ visibility: c.canDrill ? 'visible' : 'hidden' }"
                />
              </component>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        :title="t('walletDetail.period')"
        icon="mdi-calendar-range"
        class="wallet-period flex-0-0"
      >
        <!-- density/size verilmez: varsayılan yükseklik (36px) dikeyde nefes
         aldırır. density="comfortable" + size="small" bunu ~28px'e indirip
         butonları sıkıştırıyordu. -->
        <v-btn-toggle
          v-model="period"
          direction="vertical"
          color="primary"
          mandatory
          class="w-100"
        >
          <v-btn v-for="opt in periodOptions" :key="opt.value" :value="opt.value" class="justify-start">
            {{ opt.label }}
          </v-btn>
        </v-btn-toggle>
      </SectionCard>
    </div>

    <!-- Etiket dağılımı: kategori pastasının yanıtlamadığı soru — para ne için
     değil, hangi BAĞLAMDA gitti (zorunlu mu keyfi mi, planlı mı plansız mı). -->
    <SectionCard
      v-if="tagBreakdown.length"
      :title="t('walletDetail.byTag')"
      :subtitle="t('walletDetail.byTagDesc')"
      icon="mdi-tag-multiple-outline"
      class="mt-4"
    >
      <div class="wallet-tagbars">
        <div v-for="tg in tagBreakdown" :key="tg.key" class="wallet-tagbar">
          <div class="d-flex align-center ga-2 mb-1">
            <span class="text-caption text-truncate flex-1-1">{{ tg.title }}</span>
            <span class="text-caption font-weight-medium">{{ fmt.money(tg.value, wallet.currency) }}</span>
            <span class="text-caption text-medium-emphasis wallet-tagbar-pct">
              {{ fmt.percent(tg.ratio) }}
            </span>
          </div>
          <v-progress-linear :model-value="tg.ratio" :color="tg.color" height="6" />
        </div>
      </div>
      <!-- Bu not şart: çubukların toplamı %100 etmez ve bu bir hata değil.
       Açıklanmazsa kullanıcı rakamların bozuk olduğunu düşünür. -->
      <div class="text-caption text-medium-emphasis mt-3">
        {{ t('walletDetail.byTagNote') }}
      </div>
    </SectionCard>
  </div>
</template>

<style scoped>
/* Şerit hücreleri genişliği EŞİT paylaşır → sağda/ortada boşluk kalmaz.
   min-width: dar ekranda alta inerler, sıkışıp okunmaz olmazlar.
   flex-basis 0: içerik uzunluğu payı bozmasın (auto olsaydı uzun açıklama
   diğerlerini ezerdi). */
.wallet-fact {
  flex: 1 1 0;
  min-width: 130px;
}

/* Bakiye ana bilgi → iki pay alır. */
.wallet-fact--main {
  flex-grow: 2;
  min-width: 200px;
}

/* Açıklama uzun olabilir → fazladan pay, taşan kısım "…" (tam metin title'da). */
.wallet-fact--desc {
  flex-grow: 2;
  min-width: 180px;
}

/* Grafik ve kategori sütunları genişliği paylaşır. min-width:0 şart — yoksa
   içlerindeki grafik/legend öğeyi kısaltamaz ve dönem sütununu taşırır. */
.wallet-col {
  min-width: 0;
  display: flex;
}
.wallet-col > * {
  width: 100%;
}
.wallet-col--trend {
  flex: 1 1 480px;
}
.wallet-col--cat {
  flex: 1 1 340px;
}

/* Dönem toggle'ının track zemini app.css'te kaldırılıyor (dikey toggle kuralı) —
   burada tekrarlanmıyor, yoksa İstatistik'teki Dönem kartı geride kalırdı;
   nitekim öyle olmuştu. */

/* Dönem sütunu: SABİT genişlik değil alt sınır.
   150px sabitken "Son 365 gün" sınırdaydı; Rusça karşılığı ("Последние 365 дней")
   çok daha uzun ve taşardı. min-width ile sütun içeriğe göre büyür, dile bağlı
   kırılma olmaz. flex-0-0 sayesinde dar ekranda alta iner. */
.wallet-period {
  min-width: 190px;
}

/* Sayaç kutucukları dar ekranda alta iner, sıkışmaz. */
.wallet-kpi {
  min-width: 160px;
}

/* Yan yana paneller aynı yükseklikte dursun. */
/* Bakiye seyri kartı: yüksekliği kategori kartı belirler, grafik ona uyar.
   Vuetify'ın .v-card'ı display:block — yani v-card-text'in kendi
   `flex: 1 1 auto`'su işlemez; kartı elle flex kolonu yapmadan grafik çöker. */
.wallet-col--trend :deep(.v-card) {
  display: flex;
  flex-direction: column;
}
/* min-height:0 şart: flex öğesi varsayılan olarak içeriğinden kısalmaz. */
.wallet-col--trend :deep(.v-card-text) {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* Legend metni kesilebilsin (flex içinde min-width:0 şart). */
.wallet-legend {
  min-width: 0;
}

/* <button> olarak render edilen satırlar tarayıcı varsayılanlarını taşır
   (zemin, çerçeve, font) — sıfırlanmazsa inilebilen satırlar diğerlerinden
   farklı görünürdü. width:100% şart: button içeriğine göre daralır. */
.wallet-legend-row {
  width: 100%;
  background: none;
  border: 0;
  padding: 2px 4px;
  margin-inline: -4px;
  color: inherit;
  font: inherit;
  border-radius: max(0px, calc(var(--app-radius) - 6px));
}
.wallet-legend-row--drill {
  cursor: pointer;
}
.wallet-legend-row--drill:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}

/* Etiket çubukları iki sütun: 8-9 satır tek sütunda kartı gereksiz uzatıyordu.
   auto-fit + minmax → dar ekranda kendiliğinden tek sütuna iner. */
.wallet-tagbars {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px 24px;
}
.wallet-tagbar {
  min-width: 0;
}
/* Yüzdeler sağda hizalı: değişken genişlikte olsalar sütun tırtıklı görünür. */
.wallet-tagbar-pct {
  min-width: 34px;
  text-align: end;
}
</style>
