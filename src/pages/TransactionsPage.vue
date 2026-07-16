<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { endOfDay, startOfDay } from 'date-fns'

import { walletIdsOfTrn } from '@/features/wallets/trnLink'
import { useWalletsStore } from '@/features/wallets/store'
import { useCategoriesStore } from '@/features/categories/store'
import { useTagsStore } from '@/features/tags/store'
import { useTrnsStore } from '@/features/trns/store'
import { useCurrenciesStore } from '@/features/currencies/store'
import { useTrnsFormStore } from '@/features/trnForm/store'
import { TrnType, type TrnId, type TrnItem } from '@/features/trns/types'
import type { WalletId } from '@/features/wallets/types'
import DateRangeField from '@/components/DateRangeField.vue'
import AppEmptyState from '@/components/AppEmptyState.vue'
import { useAppBarAction } from '@/composables/useAppBarAction'

const { t } = useI18n()
const walletsStore = useWalletsStore()
const categoriesStore = useCategoriesStore()
const tagsStore = useTagsStore()
const trnsStore = useTrnsStore()
const currenciesStore = useCurrenciesStore()
const trnForm = useTrnsFormStore()
const fmt = useFormat()

// Kart başlığı şeridi ("Liste" + sağda ekle düğmesi) — Kategoriler/Etiketler ile
// aynı desen. Bu çağrı olmadan şerit hiç render edilmiyordu (DefaultLayout,
// yalnız action varsa çiziyor). Ekle: global işlem formunu açar.
useAppBarAction(() => ({ icon: '$add', label: t('trnsPage.add'), onClick: () => trnForm.openFormForCreate() }))

/**
 * İşlemin türü — tabloda gösterilen ayrım. WalletDetailPage ile AYNI kural:
 * düzeltme (açılış bakiyesi) trn.type'ında Income/Expense taşır ama gelir/gider
 * SAYILMAZ; ayrı bir tür olarak elenir.
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

const KIND_META: Record<TrnKind, { color: string, icon: string }> = {
  income: { color: 'success', icon: 'mdi-arrow-bottom-left' },
  expense: { color: 'error', icon: 'mdi-arrow-top-right' },
  transfer: { color: 'info', icon: 'mdi-swap-horizontal' },
  adjustment: { color: 'grey', icon: 'mdi-scale-balance' },
}

/**
 * Pasta dilim rengi — KIND_META'daki tema ADLARININ CSS karşılığı.
 * Gerekli çünkü VPie item.color'ı doğrudan CSS `color`'a yazıyor (fill:
 * currentColor); 'success'/'error'/'info' geçerli CSS rengi DEĞİL, dilim renksiz
 * kalırdı. Tür rozetiyle (v-chip) aynı renkler → pasta ile tablo aynı dili konuşur.
 */
const KIND_PIE_COLOR: Record<TrnKind, string> = {
  income: 'rgb(var(--v-theme-success))',
  expense: 'rgb(var(--v-theme-error))',
  transfer: 'rgb(var(--v-theme-info))',
  adjustment: 'grey',
}

function kindLabel(kind: TrnKind) {
  return kind === 'adjustment' ? t('walletDetail.adjustment') : t(`trnForm.${kind}`)
}

/**
 * İşlemin cüzdanının para birimi. Cüzdandan bağımsız bir listede her satır KENDİ
 * cüzdanının biriminde biçimlenir — hepsini temel birime çevirmek yanıltıcı olur.
 * Transferde çıkış cüzdanının birimi baz alınır (gösterilen tutar da çıkıştır).
 */
function currencyOf(trn: TrnItem): string {
  const wid = trn.type === TrnType.Transfer ? trn.expenseWalletId : trn.walletId
  return walletsStore.itemsComputed[wid]?.currency ?? currenciesStore.base
}

/** Cüzdan etiketi. Transfer iki cüzdana dokunur → "Kaynak → Hedef". */
function walletLabelOf(trn: TrnItem): string {
  const name = (id: WalletId) => walletsStore.itemsComputed[id]?.name ?? '—'
  if (trn.type === TrnType.Transfer) {
    return trn.expenseWalletId === trn.incomeWalletId
      ? name(trn.expenseWalletId)
      : `${name(trn.expenseWalletId)} → ${name(trn.incomeWalletId)}`
  }
  return name(trn.walletId)
}

/**
 * Gösterilen tutar. Gelir +, gider −, düzeltme türüne göre işaretli.
 * Transferde tek cüzdan bakışı yok → çıkan tutar (mutlak) gösterilir, nötr renk.
 */
function amountOf(trn: TrnItem): number {
  if (trn.type === TrnType.Transfer)
    return trn.expenseAmount
  return trn.type === TrnType.Income ? trn.amount : -trn.amount
}

type TrnRow = {
  id: TrnId
  date: number
  kind: TrnKind
  walletLabel: string
  walletIds: WalletId[]
  categoryName: string
  categoryIcon: string
  categoryColor: string
  desc: string
  tagNames: string[]
  amount: number
  currency: string
}

/** Tüm işlemler, yeniden eskiye. Cüzdan farketmez. */
const trnRows = computed<TrnRow[]>(() => {
  const trns = trnsStore.items
  if (!trns)
    return []
  const rows: TrnRow[] = []
  for (const id in trns) {
    const trn = trns[id]!
    const category = categoriesStore.items[trn.categoryId]
    rows.push({
      id,
      date: trn.date,
      kind: trnKind(trn),
      walletLabel: walletLabelOf(trn),
      walletIds: walletIdsOfTrn(trn),
      categoryName: trn.categoryId === 'transfer'
        ? t('walletDetail.transfer')
        : trn.categoryId === 'adjustment'
          ? t('walletDetail.adjustment')
          : category?.name ?? trn.categoryId,
      categoryIcon: category?.icon || 'mdi-help-circle-outline',
      categoryColor: category?.color || 'grey',
      desc: trn.desc ?? '',
      tagNames: (trn.tagIds ?? []).map(tid => tagsStore.items[tid]?.name).filter((x): x is string => !!x),
      amount: amountOf(trn),
      currency: currencyOf(trn),
    })
  }
  return rows.toSorted((a, b) => b.date - a.date)
})

// --- Süzgeçler (WalletDetailPage ile aynı desen + cüzdan süzgeci) -----------
const trnFilters = reactive({
  dateRange: [] as Date[],
  kinds: [] as TrnKind[],
  wallets: [] as WalletId[],
  categories: [] as string[],
  desc: '',
  tags: [] as string[],
  minAmount: null as number | null,
})

/** Tür seçenekleri: dört türün hepsi sabit — sistemde geçmese de anlamlı. */
const filterKindOptions = computed(() =>
  (Object.keys(KIND_META) as TrnKind[]).map(k => ({ value: k, title: kindLabel(k) })),
)

/** Cüzdan seçenekleri: listede GEÇEN cüzdanlar — boş seçenek gösterme. */
const filterWalletOptions = computed(() => {
  const ids = new Set<WalletId>()
  for (const r of trnRows.value)
    for (const id of r.walletIds)
      ids.add(id)
  return [...ids]
    .map(id => ({ value: id, title: walletsStore.itemsComputed[id]?.name ?? id }))
    .toSorted((a, b) => a.title.localeCompare(b.title))
})

const filterCategoryOptions = computed(() =>
  [...new Set(trnRows.value.map(r => r.categoryName))].toSorted((a, b) => a.localeCompare(b)),
)
const filterTagOptions = computed(() =>
  [...new Set(trnRows.value.flatMap(r => r.tagNames))].toSorted((a, b) => a.localeCompare(b)),
)

const hasFilter = computed(() =>
  trnFilters.dateRange.length > 0 || trnFilters.kinds.length > 0
  || trnFilters.wallets.length > 0 || trnFilters.categories.length > 0
  || trnFilters.desc.trim() !== '' || trnFilters.tags.length > 0
  || trnFilters.minAmount !== null,
)

function clearFilters() {
  trnFilters.dateRange = []
  trnFilters.kinds = []
  trnFilters.wallets = []
  trnFilters.categories = []
  trnFilters.desc = ''
  trnFilters.tags = []
  trnFilters.minAmount = null
}

/** Süzgeçler VE'lenir; her biri ayrı bir daraltma. */
const filteredTrnRows = computed(() => trnRows.value.filter((r) => {
  if (trnFilters.dateRange.length) {
    const days = trnFilters.dateRange.map(d => d.getTime()).toSorted((a, b) => a - b)
    const start = startOfDay(days[0]!).getTime()
    const end = endOfDay(days.at(-1)!).getTime()
    if (r.date < start || r.date > end)
      return false
  }
  if (trnFilters.kinds.length && !trnFilters.kinds.includes(r.kind))
    return false
  // Cüzdan: satırın dokunduğu cüzdanlardan biri seçiliyse geçer (transfer iki taraflı).
  if (trnFilters.wallets.length && !r.walletIds.some(id => trnFilters.wallets.includes(id)))
    return false
  if (trnFilters.categories.length && !trnFilters.categories.includes(r.categoryName))
    return false
  if (trnFilters.desc.trim()
    && !r.desc.toLocaleLowerCase().includes(trnFilters.desc.trim().toLocaleLowerCase())) {
    return false
  }
  if (trnFilters.tags.length && !r.tagNames.some(n => trnFilters.tags.includes(n)))
    return false
  if (trnFilters.minAmount !== null && Math.abs(r.amount) < trnFilters.minAmount)
    return false
  return true
}))

const trnHeaders = computed(() => [
  { title: t('trnForm.date'), key: 'date', sortable: true, width: 200, nowrap: true },
  { title: t('walletDetail.type'), key: 'kind', sortable: true, width: 150, nowrap: true },
  { title: t('trnsPage.wallet'), key: 'walletLabel', sortable: true, width: 200, nowrap: true },
  { title: t('trnForm.category'), key: 'categoryName', sortable: true, width: 200, nowrap: true },
  { title: t('trnForm.description'), key: 'desc', sortable: true, nowrap: true },
  { title: t('walletDetail.tags'), key: 'tagNames', sortable: false, nowrap: true },
  { title: t('trnForm.amount'), key: 'amount', align: 'end', sortable: true, width: 170, nowrap: true },
] as const)

/** Hiç işlem var mı? Kategoriler/Etiketler ile aynı desen: veri yoksa sayfa
    genelinde boş durum, veri varsa özet + tablo. */
const hasTrns = computed(() => trnRows.value.length > 0)

/** Filtreli işlemlerin TÜR bazında adedi — tek geçiş (KPI + pasta ortak kaynak). */
const kindCounts = computed(() => {
  const counts: Record<TrnKind, number> = { income: 0, expense: 0, transfer: 0, adjustment: 0 }
  for (const r of filteredTrnRows.value)
    counts[r.kind]++
  return counts
})

/**
 * Özet şerit sayaçları (Etiketler sayfasındaki KPI şeridiyle aynı desen).
 * SAYI bazlı — tutar DEĞİL: her cüzdan farklı para biriminde, tüm işlemleri tek
 * toplama indirmek yanıltıcı olurdu. Süzgece göre güncellenir: ekranda ne
 * görünüyorsa onu özetler.
 */
const kpis = computed(() => {
  const c = kindCounts.value
  return [
    { key: 'total', label: t('trnsPage.total'), value: fmt.number(filteredTrnRows.value.length) },
    { key: 'income', label: t('trnForm.income'), value: fmt.number(c.income) },
    { key: 'expense', label: t('trnForm.expense'), value: fmt.number(c.expense) },
    { key: 'transfer', label: t('trnForm.transfer'), value: fmt.number(c.transfer) },
  ]
})

/**
 * Tür dağılımı donutu (Etiketler/Kategoriler pastasıyla aynı desen). Dilim rengi
 * tür rozetiyle AYNI (KIND_META) → pasta ile tablo çipleri aynı dili konuşur.
 * Değeri 0 olan tür dilim üretmez.
 */
const kindPie = computed(() =>
  (Object.keys(KIND_META) as TrnKind[])
    .map(k => ({ key: k, title: kindLabel(k), value: kindCounts.value[k], color: KIND_PIE_COLOR[k] }))
    .filter(slice => slice.value > 0),
)

function onRowClick(_e: unknown, { item }: { item: TrnRow }) {
  trnForm.openFormForEdit(item.id)
}
</script>

<template>
  <div class="trns-page pa-4">
    <template v-if="hasTrns">
      <!-- Özet şerit: filtreli işlem sayısı + tür kırılımı (Etiketler/Kategoriler
           KPI şeridiyle aynı desen). Süzgeç aktifse sağda temizle düğmesi. -->
      <v-sheet color="surface-light" class="d-flex align-center ga-6 pa-4 mb-3 flex-wrap flex-0-0">
        <!-- Tür dağılımı: hiç işlem yoksa donut anlamsız → gizle. -->
        <v-pie
          v-if="filteredTrnRows.length"
          :items="kindPie"
          :size="80"
          :inner-cut="64"
          :gap="2"
          rounded="2"
          tooltip
        >
          <template #center>
            <div class="text-body-2 font-weight-bold">{{ fmt.number(filteredTrnRows.length) }}</div>
          </template>
        </v-pie>

        <div v-for="kpi in kpis" :key="kpi.key">
          <div class="text-h5 font-weight-bold">{{ kpi.value }}</div>
          <div class="text-caption text-medium-emphasis">{{ kpi.label }}</div>
        </div>
        <v-spacer />
        <v-btn
          v-if="hasFilter"
          variant="text"
          size="small"
          prepend-icon="mdi-filter-off-outline"
          @click="clearFilters"
        >
          {{ t('walletDetail.clearFilters') }}
        </v-btn>
      </v-sheet>

      <!-- Tablo doğrudan sayfada (sarmalayıcı kart yok) — Kategoriler/Etiketler gibi.
           Kolon başlığı kart yüzeyiyle (surface) aynı ton → ayrı koyu bant görünmez. -->
      <v-data-table-virtual
        :headers="trnHeaders"
        :items="filteredTrnRows"
        item-value="id"
        density="comfortable"
        hover
        fixed-header
        class="bg-transparent trns-table"
        :sort-by="[{ key: 'date', order: 'desc' }]"
        @click:row="onRowClick"
      >
        <!-- #headers slot'u varsayılan başlık satırının YERİNE geçer; ilk satır
             burada elle çizilir (sıralama korunur). İkinci satır süzgeçler:
             her girdi kendi kolonunun altında. WalletDetailPage ile aynı desen. -->
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

          <tr class="trn-filters">
            <td v-for="column in columns" :key="String(column.key)">
              <DateRangeField
                v-if="column.key === 'date'"
                v-model="trnFilters.dateRange"
                :placeholder="t('walletDetail.filterDate')"
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
                  <span v-if="index === 0" class="text-caption text-truncate">
                    {{ trnFilters.kinds.length === 1 ? opt.title : t('walletDetail.nSelected', { n: trnFilters.kinds.length }) }}
                  </span>
                </template>
              </v-select>
              <v-select
                v-else-if="column.key === 'walletLabel'"
                v-model="trnFilters.wallets"
                :items="filterWalletOptions"
                :placeholder="t('trnsPage.allWallets')"
                density="compact"
                variant="outlined"
                hide-details
                multiple
                clearable
              >
                <template #selection="{ index, item: opt }">
                  <span v-if="index === 0" class="text-caption text-truncate">
                    {{ trnFilters.wallets.length === 1 ? opt.title : t('walletDetail.nSelected', { n: trnFilters.wallets.length }) }}
                  </span>
                </template>
              </v-select>
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
                  <span v-if="index === 0" class="text-caption text-truncate">
                    {{ trnFilters.categories.length === 1 ? trnFilters.categories[0] : t('walletDetail.nSelected', { n: trnFilters.categories.length }) }}
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
                  <span v-if="index === 0" class="text-caption text-truncate">
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
          <span class="text-body-2">{{ fmt.date(item.date) }}</span>
        </template>

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

        <template #[`item.walletLabel`]="{ item }">
          <span class="text-body-2 text-truncate">{{ item.walletLabel }}</span>
        </template>

        <template #[`item.categoryName`]="{ item }">
          <div class="d-flex align-center ga-3 py-1">
            <v-avatar :color="item.categoryColor" size="28">
              <v-icon :icon="item.categoryIcon" color="white" size="16" />
            </v-avatar>
            <span class="text-truncate">{{ item.categoryName }}</span>
          </div>
        </template>

        <template #[`item.desc`]="{ item }">
          <span v-if="item.desc" class="text-body-2">{{ item.desc }}</span>
          <span v-else class="text-disabled">—</span>
        </template>

        <template #[`item.tagNames`]="{ item }">
          <div v-if="item.tagNames.length" class="d-flex ga-1">
            <v-chip v-for="n in item.tagNames" :key="n" size="x-small" variant="tonal">{{ n }}</v-chip>
          </div>
          <span v-else class="text-disabled">—</span>
        </template>

        <!-- Transfer nötr renk (tek cüzdan bakışı yok); gelir yeşil, gider kırmızı. -->
        <template #[`item.amount`]="{ item }">
          <span
            class="text-body-2 font-weight-medium"
            :class="item.kind === 'transfer' ? 'text-info' : item.amount >= 0 ? 'text-success' : 'text-error'"
          >
            {{ fmt.money(item.amount, item.currency) }}
          </span>
        </template>

        <template #no-data>
          <AppEmptyState
            :icon="hasFilter ? 'mdi-filter-off-outline' : 'mdi-swap-horizontal'"
            :title="hasFilter ? t('walletDetail.noFilterMatch') : t('trnsPage.noTrns')"
            :action-text="hasFilter ? t('walletDetail.clearFilters') : undefined"
            action-icon="mdi-filter-off-outline"
            @action="clearFilters"
          />
        </template>
      </v-data-table-virtual>
    </template>

    <!-- Hiç işlem yoksa sayfa genelinde boş durum + işlem ekle eylemi. -->
    <AppEmptyState
      v-else
      icon="mdi-swap-horizontal"
      :title="t('trnsPage.noTrns')"
      :action-text="t('trnsPage.add')"
      action-icon="mdi-plus"
      @action="trnForm.openFormForCreate()"
    />
  </div>
</template>

<style scoped>
/* Kategoriler/Etiketler ile aynı yapı: özet şerit sabit, kalan alanın tamamı
   tabloya gider, tablo kendi içinde kayar (kart 100dvh tabanlı). */
.trns-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
}

/* min-height:0 şart: flex öğesi içeriğinden kısalmaz, yoksa tablo taşar ve iç
   kaydırma hiç oluşmaz. */
.trns-table {
  flex: 1 1 auto;
  min-height: 0;
}

.trns-table :deep(tbody tr) {
  cursor: pointer;
}

/* Kolon başlığı (th) için ayrı zemin YOK: tablo doğrudan kart yüzeyinde
   (surface) durduğundan Vuetify'ın fixed-header varsayılanı (th { background:
   surface }) zaten kartla aynı ton → görünür bant oluşmaz.
   Süzgeç satırı td ise bu varsayılanı almaz; sabit başlıkla yapışması ve opak
   kalması için (altından kayan satırlar sızmasın) surface zemini elle verilir. */
.trns-table :deep(.trn-filters td) {
  background: rgb(var(--v-theme-surface));
  padding: 6px 8px;
  vertical-align: middle;
  cursor: default;
  position: sticky;
  top: var(--v-table-header-height);
  z-index: 1;
}
</style>
