<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { endOfDay, startOfDay } from 'date-fns'
import { useRoute, useRouter } from 'vue-router'

import { walletIcon } from '@/features/wallets/walletMeta'
import { walletIdsOfTrn } from '@/features/wallets/trnLink'
import { useWalletsStore } from '@/features/wallets/store'
import { useCategoriesStore } from '@/features/categories/store'
import { getParentCategoryIdOrReturnSame } from '@/features/categories/utils'
import { useTagsStore } from '@/features/tags/store'
import { useTrnsStore } from '@/features/trns/store'
import { useUserStore } from '@/features/user/store'
import { useCurrenciesStore } from '@/features/currencies/store'
import { useTrnsFormStore } from '@/features/trnForm/store'
import { TrnType, type TrnId, type TrnItem } from '@/features/trns/types'
import WalletFormDialog from '@/features/wallets/components/WalletFormDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import SectionCard from '@/components/SectionCard.vue'
import WalletBalanceChart from '@/features/wallets/components/WalletBalanceChart.vue'
import { usePageHeader } from '@/composables/usePageHeader'
import { useAppBarAction } from '@/composables/useAppBarAction'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const walletsStore = useWalletsStore()
const categoriesStore = useCategoriesStore()
const tagsStore = useTagsStore()
const trnsStore = useTrnsStore()
const userStore = useUserStore()
const currenciesStore = useCurrenciesStore()
const trnForm = useTrnsFormStore()
const fmt = useFormat()

const walletId = computed(() => String(route.params.id))
const wallet = computed(() => walletsStore.itemsComputed[walletId.value] ?? null)

/**
 * Şerit sekmeleri: özet (kartlar) / işlemler (liste).
 *
 * usePageHeader'dan ÖNCE tanımlanmalı: oradaki watchEffect ANINDA çalışır ve
 * bu ref'i okur. Aşağı taşınırsa "Cannot access 'tab' before initialization"
 * ile sayfa açılışta çöker (typecheck bunu callback içinden göremez).
 */
const tab = ref<'summary' | 'trns'>('summary')

/** Bant başlığını devral: burada "Cüzdanlar" değil cüzdanın kendi adı yazmalı. */
usePageHeader(() => ({
  title: wallet.value?.name ?? t('nav.wallets'),
  desc: wallet.value ? t(`wallets.types.${wallet.value.type}`) : undefined,
  icon: wallet.value ? walletIcon(wallet.value) : '$navWallets',
  backTo: '/wallets',
  tabs: {
    items: [
      { value: 'summary', label: t('walletDetail.tabSummary'), icon: 'mdi-view-dashboard-outline' },
      { value: 'trns', label: t('walletDetail.transactions'), icon: 'mdi-swap-horizontal' },
    ],
    model: tab.value,
    onChange: (v: string) => { tab.value = v as 'summary' | 'trns' },
  },
}))

const isDefault = computed(() => userStore.defaultWalletId === walletId.value)


const showEdit = ref(false)
const confirmDelete = ref(false)

function toggleDefault() {
  userStore.saveDefaultWalletId(isDefault.value ? null : walletId.value)
}

/**
 * Cüzdan eylemleri kart şeridinde ("Detay"ın sağında) toplanır — bakiye
 * kartında dağınık duruyorlardı. Getter: yıldız, varsayılan durumuna göre
 * dolu/boş değişiyor.
 *
 * DİKKAT: useAppBarAction içindeki watchEffect ANINDA çalışır, yani buradaki
 * getter setup sırasında bir kez hemen değerlendirilir. Okuduğu her şey
 * (isDefault) bu çağrıdan ÖNCE tanımlı olmalı — aşağı taşınırsa
 * "Cannot access before initialization" ile sayfa açılışta çöker.
 */
useAppBarAction(() => [
  {
    icon: isDefault.value ? 'mdi-star' : 'mdi-star-outline',
    label: isDefault.value ? t('walletDetail.unsetDefault') : t('wallets.setDefault'),
    variant: 'text' as const,
    onClick: toggleDefault,
  },
  { icon: 'mdi-pencil-outline', label: t('common.edit'), onClick: () => (showEdit.value = true) },
  {
    icon: 'mdi-trash-can-outline',
    label: t('common.delete'),
    color: 'error',
    variant: 'text' as const,
    onClick: () => (confirmDelete.value = true),
  },
])

// --- Dönem süzgeci ------------------------------------------------------
type PeriodKey = '30' | '90' | '365' | 'all'
const period = ref<PeriodKey>('90')
const periodOptions = computed(() => [
  { value: '30' as const, label: t('walletDetail.days', { n: 30 }) },
  { value: '90' as const, label: t('walletDetail.days', { n: 90 }) },
  { value: '365' as const, label: t('walletDetail.days', { n: 365 }) },
  { value: 'all' as const, label: t('walletDetail.allTime') },
])
const periodStart = computed(() =>
  period.value === 'all' ? 0 : Date.now() - Number(period.value) * 86_400_000,
)

// --- Bu cüzdanın işlemleri ---------------------------------------------
/** Cüzdana dokunan tüm işlemler, yeniden eskiye. Kural: walletIdsOfTrn (tek kaynak). */
const allTrns = computed(() => {
  const trns = trnsStore.items
  if (!trns)
    return [] as { id: TrnId, trn: TrnItem }[]
  const out: { id: TrnId, trn: TrnItem }[] = []
  for (const id in trns) {
    const trn = trns[id]!
    if (walletIdsOfTrn(trn).includes(walletId.value))
      out.push({ id, trn })
  }
  return out.toSorted((a, b) => b.trn.date - a.trn.date)
})

const periodTrns = computed(() => allTrns.value.filter(x => x.trn.date >= periodStart.value))

/** Durum çipleri: yalnız geçerli olanlar. Şablonda dört ayrı v-if okunmuyordu. */
const statusChips = computed(() => {
  const w = wallet.value
  if (!w)
    return []
  return [
    isDefault.value && { label: t('wallets.default'), icon: 'mdi-star', color: 'warning' },
    w.isArchived && { label: t('wallets.archived'), icon: 'mdi-archive-outline', color: undefined },
    w.isExcludeInTotal && { label: t('wallets.excludeInTotal'), icon: 'mdi-calculator-variant-outline', color: 'warning' },
    w.isWithdrawal && { label: t('wallets.withdrawal'), icon: 'mdi-cash-fast', color: 'success' },
  ].filter((c): c is { label: string, icon: string, color: string | undefined } => !!c)
})

/** En son hareket. allTrns yeniden eskiye sıralı → ilk eleman. */
const lastTrnDate = computed(() => allTrns.value[0]?.trn.date ?? null)

/**
 * Bir işlemin BU cüzdana etkisi (kendi para biriminde, işaretli).
 * Transferde cüzdan hem gönderen hem alan olabilir; her iki taraf da ayrı ayrı sayılır.
 */
function signedAmount(trn: TrnItem): number {
  if (trn.type === TrnType.Transfer) {
    let sum = 0
    if (trn.expenseWalletId === walletId.value)
      sum -= trn.expenseAmount
    if (trn.incomeWalletId === walletId.value)
      sum += trn.incomeAmount
    return sum
  }
  return trn.type === TrnType.Income ? trn.amount : -trn.amount
}

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
    if (trn.type === TrnType.Transfer || trn.categoryId === 'adjustment')
      continue
    if (trn.type === TrnType.Income)
      income += trn.amount
    else
      expense += trn.amount
  }
  return { income, expense, net: income - expense, count }
}

const flow = computed(() => flowOf(periodTrns.value))

// --- Önceki dönemle karşılaştırma ---------------------------------------
/**
 * Aynı uzunlukta bir ÖNCEKİ dönem: [start - uzunluk, start).
 *
 * Neden: "₺23.830 gider" tek başına bir şey söylemiyor — çok mu, az mı? Sayaç
 * kartları referanssızdı. Geçen döneme göre yüzde, aynı rakamı yorumlanabilir
 * yapıyor.
 *
 * 'all' seçiliyken karşılaştırma YOK: "tüm zamanlar"ın öncesi diye bir şey
 * olmadığı için bu durumda null döner ve kartlar rozetsiz çizilir.
 */
const prevPeriodTrns = computed(() => {
  if (period.value === 'all')
    return null
  const len = Number(period.value) * 86_400_000
  const start = periodStart.value - len
  return allTrns.value.filter(x => x.trn.date >= start && x.trn.date < periodStart.value)
})

const prevFlow = computed(() => (prevPeriodTrns.value ? flowOf(prevPeriodTrns.value) : null))

/**
 * Değişim oranı. null = kıyaslanamaz, gösterilmez.
 *
 * Önceki dönem 0 ise yüzde TANIMSIZDIR (0'a bölme) — "%∞ arttı" ya da "%100
 * arttı" yazmak yanlış olurdu; sıfırdan artış oransal bir artış değildir.
 * Bu yüzden yüzde yerine "yeni" durumu ayrı ele alınır (rozet gösterilmez).
 */
function changeRatio(current: number, previous: number): number | null {
  if (previous === 0)
    return null
  return ((current - previous) / Math.abs(previous)) * 100
}

/**
 * Rozet rengi. Yön TEK BAŞINA renk belirlemez: gider %20 arttıysa bu KÖTÜ,
 * gelir %20 arttıysa İYİ — ikisini de yeşil yapmak kullanıcıyı yanıltırdı.
 * Sıfıra yakın değişimler nötr: %0,4'lük bir sapmayı yeşil/kırmızı boyamak
 * olmayan bir eğilimi varmış gibi gösterir.
 */
function deltaTone(delta: number, positiveIsGood: boolean): string | undefined {
  if (Math.abs(delta) < 1)
    return undefined
  return (delta > 0) === positiveIsGood ? 'success' : 'error'
}

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

/** Temel para birimi karşılığı — cüzdan farklı bir birimdeyse gösterilir. */
const baseEquivalent = computed(() => {
  const w = wallet.value
  if (!w || w.currency === currenciesStore.base)
    return null
  return w.amount * (w.rate ?? 1)
})

// --- Kredi kartı limiti -------------------------------------------------
/**
 * Kredi kartında bakiye NEGATİFTİR (borç). Kullanılan limit = borcun mutlak değeri.
 * Bakiye pozitifse (fazla ödeme) kullanım 0 kabul edilir — negatif kullanım anlamsız.
 */
const credit = computed(() => {
  const w = wallet.value
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
  for (const { trn } of periodTrns.value) {
    if (trn.type !== TrnType.Expense || trn.categoryId === 'adjustment')
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

/** Dönem/cüzdan değişince iniş sıfırlanır: seçili kökün yeni dönemde hiç
    harcaması olmayabilir, kullanıcı boş bir pastada kilitli kalırdı. */
watch([period, walletId], () => {
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
  const sums = new Map<string, number>()
  let untagged = 0
  for (const { trn } of periodTrns.value) {
    if (trn.type !== TrnType.Expense || trn.categoryId === 'adjustment')
      continue
    const ids = trn.tagIds ?? []
    if (!ids.length) {
      untagged += trn.amount
      continue
    }
    for (const id of ids)
      sums.set(id, (sums.get(id) ?? 0) + trn.amount)
  }

  const total = periodExpenseTotal.value
  const rows = [...sums.entries()]
    .map(([id, value]) => ({
      key: id,
      title: tagsStore.items[id]?.name ?? id,
      color: tagsStore.items[id]?.color || 'grey',
      value,
      ratio: total > 0 ? (value / total) * 100 : 0,
    }))
    .toSorted((a, b) => b.value - a.value)
    .slice(0, TAG_LIMIT)

  // Etiketsiz gider ayrı satır: hiçbir çubukta görünmediği için sessizce
  // kaybolurdu — "etiketlerin toplamı neden tutmuyor" sorusunun cevabı bu.
  if (untagged > 0) {
    rows.push({
      key: '__untagged',
      title: t('walletDetail.untagged'),
      color: 'grey',
      value: untagged,
      ratio: total > 0 ? (untagged / total) * 100 : 0,
    })
  }
  return rows
})

// --- İşlem tablosu ------------------------------------------------------
/**
 * İşlemin türü — tabloda gösterilen ayrım.
 *
 * TrnType'ın AYNISI DEĞİL: düzeltme (açılış bakiyesi vb.) TrnType olarak
 * Income/Expense taşır ama gelir/gider SAYILMAZ — yukarıdaki `flow` onu hariç
 * tutuyor. Türü doğrudan trn.type'tan okusaydık 68.000'lik bir açılış kaydına
 * "Gelir" yazardı, üstteki gelir toplamı ise onu saymazdı: aynı ekranda iki
 * çelişen rakam. Bu yüzden düzeltme ayrı bir tür.
 */
type TrnKind = 'income' | 'expense' | 'transfer' | 'adjustment'

/** Sıra önemli: düzeltme trn.type'ında Income/Expense görünür, ÖNCE elenmeli. */
function trnKind(trn: TrnItem): TrnKind {
  if (trn.categoryId === 'adjustment')
    return 'adjustment'
  if (trn.type === TrnType.Transfer)
    return 'transfer'
  return trn.type === TrnType.Income ? 'income' : 'expense'
}

/** Tür rozetinin görünümü. Ok yönü CÜZDAN BAKIŞ AÇISI: giren ↙, çıkan ↗. */
const KIND_META: Record<TrnKind, { color: string, icon: string }> = {
  income: { color: 'success', icon: 'mdi-arrow-bottom-left' },
  expense: { color: 'error', icon: 'mdi-arrow-top-right' },
  transfer: { color: 'info', icon: 'mdi-swap-horizontal' },
  adjustment: { color: 'grey', icon: 'mdi-scale-balance' },
}

function kindLabel(kind: TrnKind) {
  return kind === 'adjustment' ? t('walletDetail.adjustment') : t(`trnForm.${kind}`)
}

type TrnRow = {
  id: TrnId
  date: number
  kind: TrnKind
  categoryName: string
  categoryIcon: string
  categoryColor: string
  desc: string
  tagNames: string[]
  amount: number
}

const trnRows = computed<TrnRow[]>(() => periodTrns.value.map(({ id, trn }) => {
  const category = categoriesStore.items[trn.categoryId]
  return {
    id,
    date: trn.date,
    kind: trnKind(trn),
    categoryName: trn.categoryId === 'transfer'
      ? t('walletDetail.transfer')
      : trn.categoryId === 'adjustment'
        ? t('walletDetail.adjustment')
        : category?.name ?? trn.categoryId,
    categoryIcon: category?.icon || 'mdi-help-circle-outline',
    categoryColor: category?.color || 'grey',
    desc: trn.desc ?? '',
    tagNames: (trn.tagIds ?? []).map(tid => tagsStore.items[tid]?.name).filter((x): x is string => !!x),
    amount: signedAmount(trn),
  }
}))

/**
 * İşlem tablosu süzgeçleri (tablo başlığının ALTINDAKİ ikinci satır).
 * Kolon bazlı: her girdi kendi kolonuna hizalı, hangisini süzdüğün belli.
 */
const trnFilters = reactive({
  /**
   * Tarih ARALIĞI (VDateInput multiple="range" → Date[]).
   * Önce biçimlenmiş metinde arama yapıyordu; "07.2026" gibi bir şey yazmak
   * gerekiyordu ve dil/biçim ayarı değişince kullanıcının yazdığı desen
   * sessizce tutmaz oluyordu. Aralık hem net hem biçimden bağımsız.
   */
  dateRange: [] as Date[],
  kinds: [] as TrnKind[],
  categories: [] as string[],
  /** İşlem açıklamasında serbest metin araması. */
  desc: '',
  tags: [] as string[],
  /** Mutlak değer alt sınırı: "şu tutardan büyük hareketler". */
  minAmount: null as number | null,
})

/** Tür seçenekleri: dört türün hepsi sabit — cüzdanda geçmese de anlamlı. */
const filterKindOptions = computed(() =>
  (Object.keys(KIND_META) as TrnKind[]).map(k => ({ value: k, title: kindLabel(k) })),
)

/** Süzgeç seçenekleri: yalnız BU cüzdanda geçenler — boş seçenek gösterme. */
const filterCategoryOptions = computed(() =>
  [...new Set(trnRows.value.map(r => r.categoryName))].toSorted((a, b) => a.localeCompare(b)),
)
const filterTagOptions = computed(() =>
  [...new Set(trnRows.value.flatMap(r => r.tagNames))].toSorted((a, b) => a.localeCompare(b)),
)

const hasFilter = computed(() =>
  trnFilters.dateRange.length > 0 || trnFilters.kinds.length > 0
  || trnFilters.categories.length > 0 || trnFilters.desc.trim() !== ''
  || trnFilters.tags.length > 0 || trnFilters.minAmount !== null,
)

function clearFilters() {
  trnFilters.dateRange = []
  trnFilters.kinds = []
  trnFilters.categories = []
  trnFilters.desc = ''
  trnFilters.tags = []
  trnFilters.minAmount = null
}

/** Süzgeçler VE'lenir: her biri ayrı bir daraltma. */
const filteredTrnRows = computed(() => trnRows.value.filter((r) => {
  // Aralık: seçim sürerken tek tarih olabilir → o zaman "o gün".
  // Bitiş gününün TAMAMI dahil edilir; saat 00:00 ile karşılaştırmak o günün
  // işlemlerini sessizce eler.
  if (trnFilters.dateRange.length) {
    const days = trnFilters.dateRange.map(d => d.getTime()).toSorted((a, b) => a - b)
    const start = startOfDay(days[0]!).getTime()
    const end = endOfDay(days.at(-1)!).getTime()
    if (r.date < start || r.date > end)
      return false
  }
  if (trnFilters.kinds.length && !trnFilters.kinds.includes(r.kind))
    return false
  if (trnFilters.categories.length && !trnFilters.categories.includes(r.categoryName))
    return false
  // Açıklama: serbest metin, parça eşleşmesi. trim şart — kullanıcının bıraktığı
  // tek boşluk yoksa TÜM satırları elerdi (hiçbir açıklama " " içermez).
  if (trnFilters.desc.trim()
    && !r.desc.toLocaleLowerCase().includes(trnFilters.desc.trim().toLocaleLowerCase())) {
    return false
  }
  // Etiket: satır seçilenlerden EN AZ BİRİNİ taşımalı (VEYA) — işlem çok etiketli.
  if (trnFilters.tags.length && !r.tagNames.some(n => trnFilters.tags.includes(n)))
    return false
  if (trnFilters.minAmount !== null && Math.abs(r.amount) < trnFilters.minAmount)
    return false
  return true
}))

/**
 * Genişlikler süzgeç satırına göre: hücrenin içinde METİN değil FORM ALANI var,
 * dar kolonda girdi eziliyor. Tarih en genişi çünkü aralık iki tam tarih yazıyor
 * ("15.07.2026 - 30.07.2026") + takvim ve temizle ikonları.
 * Açıklama ile etiketler genişlik vermez → kalan yeri paylaşırlar.
 */
const trnHeaders = computed(() => [
  { title: t('trnForm.date'), key: 'date', sortable: true, width: 230, nowrap: true },
  { title: t('walletDetail.type'), key: 'kind', sortable: true, width: 150, nowrap: true },
  { title: t('trnForm.category'), key: 'categoryName', sortable: true, width: 220, nowrap: true },
  { title: t('trnForm.description'), key: 'desc', sortable: true, nowrap: true },
  { title: t('walletDetail.tags'), key: 'tagNames', sortable: false, nowrap: true },
  { title: t('trnForm.amount'), key: 'amount', align: 'end', sortable: true, width: 170, nowrap: true },
] as const)

function onRowClick(_e: unknown, { item }: { item: TrnRow }) {
  trnForm.openFormForEdit(item.id)
}

// --- Eylemler -----------------------------------------------------------
function remove() {
  walletsStore.deleteWallet(walletId.value)
  router.push('/wallets')
}
</script>

<template>
  <div class="wallet-detail pa-4" :class="{ 'wallet-detail--table': tab === 'trns' }">
    <!-- Cüzdan silinmiş/bilinmeyen id: sessizce boş sayfa yerine açık mesaj. -->
    <v-card v-if="!wallet" variant="tonal" class="pa-8 text-center">
      <v-icon icon="mdi-wallet-outline" size="56" class="mb-4 text-medium-emphasis" />
      <div class="text-body-large mb-4">{{ t('walletDetail.notFound') }}</div>
      <v-btn-primary to="/wallets" prepend-icon="mdi-arrow-left">{{ t('nav.wallets') }}</v-btn-primary>
    </v-card>

    <template v-else>
      <template v-if="tab === 'summary'">
      <!-- Bakiye şeridi: TEK satır, hücreler genişliği eşit paylaşır (flex: 1 1 0).
           Önce dikey bir bakiye bloğu + yanına birkaç öğe vardı; blok 4 satır
           yüksekliğindeydi ve yanındakiler genişliği dolduramıyordu — boşluk
           v-spacer'la ortada, spacer'sız sağda kalıyordu. Sorun hizalama değil
           yapıydı: doldurulacak kadar hücre yoktu. Açıklama ve durum da artık
           birer hücre; boşluk kalmıyor ve hepsi bilgi taşıyor. -->
      <v-sheet color="surface-light" class="d-flex align-center flex-wrap ga-4 pa-4 mb-4">
        <div class="wallet-fact wallet-fact--main">
          <div class="text-body-small text-medium-emphasis">{{ t('wallets.table.balance') }}</div>
          <div class="d-flex align-baseline ga-2 flex-wrap">
            <span
              class="text-headline-medium font-weight-bold"
              :class="{ 'text-error': wallet.amount < 0 }"
            >{{ fmt.money(wallet.amount, wallet.currency) }}</span>
            <!-- Karşılık AYNI satırda: alt satıra alınca blok uzuyor ve şerit
                 tek satırlık olmaktan çıkıyordu. Yalnız farklı para biriminde. -->
            <span v-if="baseEquivalent !== null" class="text-body-small text-medium-emphasis">
              ≈ {{ fmt.money(baseEquivalent, currenciesStore.base) }}
            </span>
          </div>
        </div>

        <div class="wallet-fact">
          <div class="text-body-small text-medium-emphasis">{{ t('walletDetail.lastTrn') }}</div>
          <div class="text-title-medium font-weight-medium text-truncate">
            {{ lastTrnDate ? fmt.date(lastTrnDate) : '—' }}
          </div>
        </div>

        <!-- Dönemden BAĞIMSIZ toplam; süzgeçli adet aşağıdaki sayaçta. -->
        <div class="wallet-fact">
          <div class="text-body-small text-medium-emphasis">{{ t('walletDetail.totalTrns') }}</div>
          <div class="text-title-medium font-weight-medium">{{ fmt.number(allTrns.length) }}</div>
        </div>

        <!-- Kullanılabilir limit yalnız kredi kartında anlamlı. -->
        <div v-if="credit" class="wallet-fact">
          <div class="text-body-small text-medium-emphasis">{{ t('walletDetail.available') }}</div>
          <div class="text-title-medium font-weight-medium text-truncate">
            {{ fmt.money(credit.available, wallet.currency) }}
          </div>
        </div>

        <div v-if="wallet.desc" class="wallet-fact wallet-fact--desc">
          <div class="text-body-small text-medium-emphasis">{{ t('wallets.description') }}</div>
          <div class="text-body-medium text-truncate" :title="wallet.desc">{{ wallet.desc }}</div>
        </div>

        <div v-if="statusChips.length" class="wallet-fact">
          <div class="text-body-small text-medium-emphasis">{{ t('walletDetail.status') }}</div>
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
          <span class="text-title-small font-weight-bold">{{ t('walletDetail.creditUsage') }}</span>
          <span class="text-body-medium">
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
          <span class="text-body-small text-medium-emphasis">
            {{ t('walletDetail.available') }}: {{ fmt.money(credit.available, wallet.currency) }}
          </span>
          <span class="text-body-small font-weight-medium">%{{ Math.round(credit.ratio) }}</span>
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
            <div class="text-headline-small font-weight-bold text-truncate" :class="card.tone">
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
              %{{ fmt.number(Math.abs(Math.round(card.delta))) }}
            </v-chip>
          </div>
          <div class="text-body-small text-medium-emphasis">{{ card.label }}</div>
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

            <div v-if="!categoryBreakdown.length" class="d-flex align-center ga-3 text-medium-emphasis py-6">
              <v-icon icon="mdi-chart-donut" size="32" />
              <div class="text-body-medium">{{ t('walletDetail.noExpense') }}</div>
            </div>

            <div v-else class="d-flex align-center ga-5 flex-wrap">
              <v-pie :items="categoryBreakdown" :size="150" :inner-cut="64" :gap="2" rounded="2" tooltip>
                <template #center>
                  <div class="text-body-small font-weight-bold">
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
                  <span class="text-body-small text-truncate flex-1-1 text-start">{{ c.title }}</span>
                  <span class="text-body-small text-medium-emphasis">
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
              <span class="text-body-small text-truncate flex-1-1">{{ tg.title }}</span>
              <span class="text-body-small font-weight-medium">{{ fmt.money(tg.value, wallet.currency) }}</span>
              <span class="text-body-small text-medium-emphasis wallet-tagbar-pct">
                %{{ fmt.number(Math.round(tg.ratio)) }}
              </span>
            </div>
            <v-progress-linear :model-value="tg.ratio" :color="tg.color" height="6" />
          </div>
        </div>
        <!-- Bu not şart: çubukların toplamı %100 etmez ve bu bir hata değil.
             Açıklanmazsa kullanıcı rakamların bozuk olduğunu düşünür. -->
        <div class="text-body-small text-medium-emphasis mt-3">
          {{ t('walletDetail.byTagNote') }}
        </div>
      </SectionCard>

      </template>

      <!-- İşlemler sekmesi: yalnız liste. Başlık artık şeritteki sekmede,
           kartın kendi başlığı tekrar olurdu → SectionCard yerine düz yüzey. -->
      <v-sheet v-else color="surface-light" class="pa-4 wallet-trns-surface">
        <v-data-table-virtual
          :headers="trnHeaders"
          :items="filteredTrnRows"
          item-value="id"
          density="comfortable"
          hover
          fixed-header
          class="bg-transparent wallet-trns"
          :sort-by="[{ key: 'date', order: 'desc' }]"
          @click:row="onRowClick"
        >
          <!-- #headers slot'u varsayılan başlık satırının YERİNE geçer; bu yüzden
               ilk satır burada elle çizilir. Sıralama slot'tan gelen toggleSort/
               isSorted/getSortIcon ile korunur — kendi sıralamamı yazmıyorum.
               İkinci satır süzgeçler: her girdi kendi kolonunun altında. -->
          <template #headers="{ columns, toggleSort, isSorted, getSortIcon }">
            <tr>
              <th
                v-for="column in columns"
                :key="String(column.key)"
                class="v-data-table__th"
                :class="[
                  column.sortable && 'v-data-table__th--sortable',
                  `v-data-table-column--align-${column.align ?? 'start'}`,
                ]"
                :style="{ width: column.width ? `${column.width}px` : undefined }"
                @click="column.sortable && toggleSort(column)"
              >
                <div class="v-data-table-header__content">
                  <span>{{ column.title }}</span>
                  <v-icon
                    v-if="column.sortable"
                    :icon="getSortIcon(column)"
                    size="small"
                    :class="['v-data-table-header__sort-icon', !isSorted(column) && 'text-disabled']"
                  />
                </div>
              </th>
            </tr>

            <!-- td'ye v-data-table__th VERİLMEZ: o class başlık + sticky stilleri
                 taşıyor, satırlar üst üste biniyordu. Süzgeç satırı normal hücre. -->
            <tr class="trn-filters">
              <td v-for="column in columns" :key="String(column.key)">
                <v-date-input
                  v-if="column.key === 'date'"
                  v-model="trnFilters.dateRange"
                  multiple="range"
                  :placeholder="t('walletDetail.filterDate')"
                  prepend-icon=""
                  prepend-inner-icon="$calendar"
                  density="compact"
                  variant="outlined"
                  hide-details
                  clearable
                />
                <v-select
                  v-else-if="column.key === 'kind'"
                  v-model="trnFilters.kinds"
                  :items="filterKindOptions"
                  :placeholder="t('walletDetail.filterAll')"
                  density="compact"
                  variant="outlined"
                  hide-details
                  multiple
                  clearable
                >
                  <template #selection="{ index, item: opt }">
                    <span v-if="index === 0" class="text-body-small text-truncate">
                      {{ trnFilters.kinds.length === 1 ? opt.title : t('walletDetail.nSelected', { n: trnFilters.kinds.length }) }}
                    </span>
                  </template>
                </v-select>
                <v-text-field
                  v-else-if="column.key === 'desc'"
                  v-model="trnFilters.desc"
                  :placeholder="t('walletDetail.filterDesc')"
                  prepend-inner-icon="mdi-magnify"
                  density="compact"
                  variant="outlined"
                  hide-details
                  clearable
                />
                <v-select
                  v-else-if="column.key === 'categoryName'"
                  v-model="trnFilters.categories"
                  :items="filterCategoryOptions"
                  :placeholder="t('walletDetail.filterAll')"
                  density="compact"
                  variant="outlined"
                  hide-details
                  multiple
                  clearable
                >
                  <template #selection="{ index }">
                    <!-- Çip yerine özet: çipler hücreyi büyütüp satırı taşırıyordu. -->
                    <span v-if="index === 0" class="text-body-small text-truncate">
                      {{ trnFilters.categories.length === 1 ? trnFilters.categories[0] : t('walletDetail.nSelected', { n: trnFilters.categories.length }) }}
                    </span>
                  </template>
                </v-select>
                <v-select
                  v-else-if="column.key === 'tagNames'"
                  v-model="trnFilters.tags"
                  :items="filterTagOptions"
                  :placeholder="t('walletDetail.filterAll')"
                  density="compact"
                  variant="outlined"
                  hide-details
                  multiple
                  clearable
                >
                  <template #selection="{ index }">
                    <!-- Çip yerine özet: çipler hücreyi büyütüp satırı taşırıyordu. -->
                    <span v-if="index === 0" class="text-body-small text-truncate">
                      {{ trnFilters.tags.length === 1 ? trnFilters.tags[0] : t('walletDetail.nSelected', { n: trnFilters.tags.length }) }}
                    </span>
                  </template>
                </v-select>
                <v-text-field
                  v-else-if="column.key === 'amount'"
                  :model-value="trnFilters.minAmount"
                  :placeholder="t('walletDetail.filterMinAmount')"
                  type="number"
                  density="compact"
                  variant="outlined"
                  hide-details
                  clearable
                  @update:model-value="trnFilters.minAmount = $event === '' || $event === null ? null : Number($event)"
                />
              </td>
            </tr>
          </template>
          <template #[`item.date`]="{ item }">
            <span class="text-body-medium">{{ fmt.date(item.date) }}</span>
          </template>

          <!-- Tür: renk + ok yönü rozeti. Tutarın işaretiyle aynı bilgiyi taşır
               gibi görünse de değil — transfer ve düzeltme işarete bakarak
               ayırt EDİLEMEZ (ikisi de + ya da − olabilir). -->
          <template #[`item.kind`]="{ item }">
            <v-chip
              :color="KIND_META[item.kind].color"
              :prepend-icon="KIND_META[item.kind].icon"
              size="small"
              variant="tonal"
            >
              {{ kindLabel(item.kind) }}
            </v-chip>
          </template>

          <template #[`item.categoryName`]="{ item }">
            <div class="d-flex align-center ga-3 py-1">
              <v-avatar :color="item.categoryColor" size="28">
                <v-icon :icon="item.categoryIcon" color="white" size="16" />
              </v-avatar>
              <span class="text-truncate">{{ item.categoryName }}</span>
            </div>
          </template>

          <!-- Açıklama artık kategori adının altında değil, kendi sütununda:
               kullanıcı ona göre süzüp sıralayabilsin diye. -->
          <template #[`item.desc`]="{ item }">
            <span v-if="item.desc" class="text-body-medium">{{ item.desc }}</span>
            <span v-else class="text-disabled">—</span>
          </template>

          <template #[`item.tagNames`]="{ item }">
            <div v-if="item.tagNames.length" class="d-flex ga-1">
              <v-chip v-for="n in item.tagNames" :key="n" size="x-small" variant="tonal">{{ n }}</v-chip>
            </div>
            <span v-else class="text-disabled">—</span>
          </template>

          <!-- İşaret cüzdan bakış açısından: giren +, çıkan −. Transferde bu
               cüzdanın tarafına göre belirlenir (signedAmount). -->
          <template #[`item.amount`]="{ item }">
            <span
              class="text-body-medium font-weight-medium"
              :class="item.amount >= 0 ? 'text-success' : 'text-error'"
            >
              {{ fmt.money(item.amount, wallet.currency) }}
            </span>
          </template>

          <!-- Boş durum süzgeci ayırt eder: "işlem yok" ile "süzgece uyan yok"
               farklı sorunlar; ikincisinde çıkış yolu (temizle) sunulur. -->
          <template #no-data>
            <div class="text-center py-10">
              <v-icon :icon="hasFilter ? 'mdi-filter-off-outline' : 'mdi-swap-horizontal'" size="48" class="mb-3 text-medium-emphasis" />
              <div class="text-body-large mb-3">
                {{ hasFilter ? t('walletDetail.noFilterMatch') : t('walletDetail.noTrns') }}
              </div>
              <v-btn v-if="hasFilter" variant="tonal" size="small" @click="clearFilters">
                {{ t('walletDetail.clearFilters') }}
              </v-btn>
            </div>
          </template>
        </v-data-table-virtual>
      </v-sheet>

      <WalletFormDialog v-model="showEdit" :wallet-id="walletId" />

      <ConfirmDialog
        v-model="confirmDelete"
        :title="wallet.name"
        :message="t('wallets.deleteConfirm')"
        @confirm="remove"
      />
    </template>
  </div>
</template>

<style scoped>
/* Özet sekmesi: üst üste bölümler var, sayfa kendi içinde kayar. */
.wallet-detail {
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
}

/* İşlemler sekmesi: tek bir tablo var → sayfa DEĞİL tablo kaysın ve tablo
   ekran yüksekliğini doldursun (kart zaten 100dvh tabanlı). Sabit height="420"
   yerine flex zinciri: pencere büyüdükçe tablo da büyür. */
.wallet-detail--table {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.wallet-trns-surface {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
/* min-height:0 şart: flex öğesi varsayılan olarak içeriğinden kısalmaz →
   olmazsa tablo taşar ve iç kaydırma hiç oluşmaz. */
.wallet-trns {
  flex: 1 1 auto;
  min-height: 0;
}

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

.wallet-trns :deep(tbody tr) {
  cursor: pointer;
}

/* Süzgeç satırı: başlığın altında, aynı yüzeyde. Sabit yükseklik verilir ki
   kontrol yüksekliği satırı zorlamasın ve üstteki başlıkla altındaki ilk veri
   satırı birbirine binmesin. */
/* Sabit başlık zeminini Vuetify surface veriyor:
     .v-table--fixed-header ... thead > tr > th { background: rgb(var(--v-theme-surface)) }
   Bu tablo surface-light bir kartın İÇİNDE → başlık beyaz kalıp karttan kopuyordu.
   Kartla aynı ton olmalı; opak kalması şart, altından satırlar kayıyor. */
.wallet-trns :deep(thead th),
.wallet-trns :deep(.trn-filters td) {
  background: rgb(var(--v-theme-surface-light));
}
.wallet-trns :deep(.trn-filters td) {
  padding: 6px 8px;
  vertical-align: middle;
  cursor: default;
}
/* Süzgeç satırı da başlıkla birlikte yapışsın: fixed-header YALNIZ th'yi
   yapıştırıyor, bu satır td'lerden oluşuyor.
   top = başlık satırı yüksekliği. Sabit 48px YAZILMAZ: Vuetify bu yüksekliği
   density'ye göre 40/48/56px veriyor (--v-table-header-height), sabit sayı
   density değişince sessizce kayardı. */
.wallet-trns :deep(.trn-filters td) {
  position: sticky;
  top: var(--v-table-header-height);
  z-index: 1;
}
</style>
