<script setup lang="ts">
import type { TrnFilterRow, TrnFilters } from '@/features/trns/lib/trnFilters'
import type { TrnKind } from '@/features/trns/lib/trnKind'
import type { TrnId, TrnItem } from '@/features/trns/types'

import { useI18n } from 'vue-i18n'
import AppEmptyState from '@/components/AppEmptyState.vue'
import DateRangeField from '@/components/DateRangeField.vue'
import { ADJUSTMENT_ID, TRANSFER_ID } from '@/features/categories/pseudoCategories'
import { useCategoriesStore } from '@/features/categories/store'
import { useTagsStore } from '@/features/tags/store'
import { useTrnsFormStore } from '@/features/trnForm/store'
import { applyTrnFilters, emptyTrnFilters, hasAnyTrnFilter } from '@/features/trns/lib/trnFilters'
import { KIND_META, trnKind, trnKindLabelKey } from '@/features/trns/lib/trnKind'
import { signedAmount as signedAmountFor } from '@/features/wallets/lib/balanceSeries'
import { keyboardRowProps } from '@/shared/lib/rowA11y'
import { ariaSort } from '@/shared/lib/sortA11y'

/**
 * Cüzdanın İŞLEMLER sekmesi: süzgeçli sanal tablo (Y-7).
 *
 * WalletDetailPage'den ayrıldı — o dosya tek başına iki tam özellik (Özet +
 * İşlemler) barındırıyordu ve 1200+ satırdı. Süzgeç KURALLARI burada değil,
 * features/trns/lib/trnFilters.ts'te (TransactionsPage ile ortak tek kaynak);
 * bu bileşen yalnız o kuralı cüzdanın satırlarına BAĞLAR ve sunar.
 */
const props = defineProps<{
  /** Gösterilecek işlemler (sayfa dönem süzgecini uygulamış olarak verir). */
  trns: { id: TrnId, trn: TrnItem }[]
  /** Tutarların işaretini bu cüzdanın bakış açısıyla hesaplamak için. */
  walletId: string
  /** Cüzdanın para birimi — tutar biçimlendirmesi. */
  currency: string
}>()

const { t } = useI18n()
const categoriesStore = useCategoriesStore()
const tagsStore = useTagsStore()
const trnForm = useTrnsFormStore()
const fmt = useFormat()

/** Tür etiketi: anahtar tek kaynakta (trnKind.ts), çeviri burada bağlanır. */
function kindLabel(kind: TrnKind) {
  return t(trnKindLabelKey(kind))
}

/**
 * İşlemin türü — tabloda gösterilen ayrım.
 *
 * TrnType'ın AYNISI DEĞİL: düzeltme (açılış bakiyesi vb.) TrnType olarak
 * Income/Expense taşır ama gelir/gider SAYILMAZ — yukarıdaki `flow` onu hariç
 * tutuyor. Türü doğrudan trn.type'tan okusaydık 68.000'lik bir açılış kaydına
 * "Gelir" yazardı, üstteki gelir toplamı ise onu saymazdı: aynı ekranda iki
 * çelişen rakam. Bu yüzden düzeltme ayrı bir tür.
 */
interface TrnRow extends TrnFilterRow {
  id: TrnId
  categoryName: string
  categoryIcon: string
  categoryColor: string
  tagNames: string[]
}

const trnRows = computed<TrnRow[]>(() => props.trns.map(({ id, trn }) => {
  const category = categoriesStore.items[trn.categoryId]
  const tagIds = trn.tagIds ?? []
  return {
    id,
    date: trn.date,
    kind: trnKind(trn),
    categoryId: trn.categoryId,
    categoryName: trn.categoryId === TRANSFER_ID
      ? t('walletDetail.transfer')
      : trn.categoryId === ADJUSTMENT_ID
        ? t('walletDetail.adjustment')
        : category?.name ?? trn.categoryId,
    categoryIcon: category?.icon || 'mdi-help-circle-outline',
    categoryColor: category?.color || 'grey',
    desc: trn.desc ?? '',
    tagIds,
    tagNames: tagIds.map(tid => tagsStore.items[tid]?.name).filter((x): x is string => !!x),
    amount: signedAmountFor(trn, props.walletId),
  }
}))

/**
 * İşlem tablosu süzgeçleri (tablo başlığının ALTINDAKİ ikinci satır).
 * Kolon bazlı: her girdi kendi kolonuna hizalı, hangisini süzdüğün belli.
 *
 * Şekil ve uygulama features/trns/lib/trnFilters.ts'te — TEK KAYNAK (Y-5);
 * TransactionsPage ve testler de aynı modülü kullanır. Kategori/etiket ID
 * tutar, ad değil (O-6).
 *
 * Tarih ARALIĞI (VDateInput multiple="range" → Date[]): önce biçimlenmiş
 * metinde arama yapıyordu; "07.2026" gibi bir şey yazmak gerekiyordu ve
 * dil/biçim ayarı değişince kullanıcının yazdığı desen sessizce tutmaz oluyordu.
 */
const trnFilters = reactive<TrnFilters>(emptyTrnFilters())

/** Tür seçenekleri: dört türün hepsi sabit — cüzdanda geçmese de anlamlı. */
const filterKindOptions = computed(() =>
  (Object.keys(KIND_META) as TrnKind[]).map(k => ({ value: k, title: kindLabel(k) })),
)

/**
 * Süzgeç seçenekleri: yalnız BU cüzdanda geçenler — boş seçenek gösterme.
 * Değer ID, başlık ad (O-6): aynı adlı iki kategori artık birbirini getirmez.
 */
const filterCategoryOptions = computed(() => {
  const byId = new Map<string, string>()
  for (const r of trnRows.value)
    byId.set(r.categoryId, r.categoryName)
  return [...byId].map(([value, title]) => ({ value, title })).toSorted((a, b) => a.title.localeCompare(b.title))
})

const filterTagOptions = computed(() => {
  const byId = new Map<string, string>()
  for (const r of trnRows.value) {
    r.tagIds.forEach((id, i) => {
      const name = r.tagNames[i]
      if (name)
        byId.set(id, name)
    })
  }
  return [...byId].map(([value, title]) => ({ value, title })).toSorted((a, b) => a.title.localeCompare(b.title))
})

/** Seçili tek öğenin ADI (özet metni için) — seçim id tutuyor, ekranda ad yazmalı. */
function optionTitle(options: { value: string, title: string }[], id: string | undefined): string {
  return options.find(o => o.value === id)?.title ?? id ?? ''
}

const hasFilter = computed(() => hasAnyTrnFilter(trnFilters))

function clearFilters() {
  Object.assign(trnFilters, emptyTrnFilters())
}

/** Süzgeçler VE'lenir. Kural tek kaynakta (trnFilters.ts); burada yalnız bağlanır. */
const filteredTrnRows = computed(() => applyTrnFilters(trnRows.value, trnFilters))

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

function openTrn(item: TrnRow) {
  trnForm.openFormForEdit(item.id)
}

function onRowClick(_e: unknown, { item }: { item: TrnRow }) {
  openTrn(item)
}

/**
 * Satırı klavyeye açar (A-4). Bu tabloda satır tıklaması işlemi düzenlemenin
 * TEK yolu — Cüzdanlar/Kategoriler/Etiketler'deki gibi satır içi kalem butonu
 * yok. `@click:row` fare olayı olduğu için klavye kullanıcısı hiçbir işlemi
 * düzenleyemiyordu.
 */
const rowProps = keyboardRowProps(openTrn)
</script>

<template>
  <v-sheet color="surface-light" class="pa-4 wallet-trns-surface">
    <v-data-table-virtual
      :headers="trnHeaders"
      :items="filteredTrnRows"
      item-value="id"
      density="comfortable"
      hover
      fixed-header
      class="bg-transparent wallet-trns"
      :sort-by="[{ key: 'date', order: 'desc' }]"
      :row-props="rowProps"
      @click:row="onRowClick"
    >
      <!-- #headers slot'u varsayılan başlık satırının YERİNE geçer; bu yüzden
           ilk satır burada elle çizilir. Sıralama slot'tan gelen toggleSort/
           isSorted/getSortIcon ile korunur — kendi sıralamamı yazmıyorum.
           İkinci satır süzgeçler: her girdi kendi kolonunun altında. -->
      <template #headers="{ columns, toggleSort, isSorted, getSortIcon, sortBy }">
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
            :aria-sort="ariaSort(column.key, column.sortable, sortBy)"
            :tabindex="column.sortable ? 0 : undefined"
            @click="column.sortable && toggleSort(column)"
            @keydown.enter.prevent="column.sortable && toggleSort(column)"
            @keydown.space.prevent="column.sortable && toggleSort(column)"
          >
            <div class="v-data-table-header__content">
              <span>{{ column.title }}</span>
              <v-icon
                v-if="column.sortable"
                :icon="getSortIcon(column)"
                size="small"
                class="v-data-table-header__sort-icon" :class="[!isSorted(column) && 'text-disabled']"
              />
            </div>
          </th>
        </tr>

        <!-- td'ye v-data-table__th VERİLMEZ: o class başlık + sticky stilleri
             taşıyor, satırlar üst üste biniyordu. Süzgeç satırı normal hücre. -->
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
            <!-- Seçim ID tutar, ekranda AD görünür (O-6): aynı adlı iki
                 kategori/etiket artık birbirini getirmez. -->
            <v-select
              v-else-if="column.key === 'categoryName'"
              v-model="trnFilters.categoryIds"
              :items="filterCategoryOptions"
              item-title="title"
              item-value="value"
              :placeholder="t('walletDetail.filterAll')"
              density="compact"
              variant="outlined"
              hide-details
              multiple
              clearable
            >
              <template #selection="{ index }">
                <!-- Çip yerine özet: çipler hücreyi büyütüp satırı taşırıyordu. -->
                <span v-if="index === 0" class="text-caption text-truncate">
                  {{ trnFilters.categoryIds.length === 1
                    ? optionTitle(filterCategoryOptions, trnFilters.categoryIds[0])
                    : t('walletDetail.nSelected', { n: trnFilters.categoryIds.length }) }}
                </span>
              </template>
            </v-select>
            <v-select
              v-else-if="column.key === 'tagNames'"
              v-model="trnFilters.tagIds"
              :items="filterTagOptions"
              item-title="title"
              item-value="value"
              :placeholder="t('walletDetail.filterAll')"
              density="compact"
              variant="outlined"
              hide-details
              multiple
              clearable
            >
              <template #selection="{ index }">
                <!-- Çip yerine özet: çipler hücreyi büyütüp satırı taşırıyordu. -->
                <span v-if="index === 0" class="text-caption text-truncate">
                  {{ trnFilters.tagIds.length === 1
                    ? optionTitle(filterTagOptions, trnFilters.tagIds[0])
                    : t('walletDetail.nSelected', { n: trnFilters.tagIds.length }) }}
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
        <span v-if="item.desc" class="text-body-2">{{ item.desc }}</span>
        <span v-else class="text-disabled">—</span>
      </template>

      <template #[`item.tagNames`]="{ item }">
        <div v-if="item.tagNames.length" class="d-flex ga-1">
          <v-chip v-for="n in item.tagNames" :key="n" size="x-small" variant="tonal">
            {{ n }}
          </v-chip>
        </div>
        <span v-else class="text-disabled">—</span>
      </template>

      <!-- İşaret cüzdan bakış açısından: giren +, çıkan −. Transferde bu
           cüzdanın tarafına göre belirlenir (signedAmount). -->
      <template #[`item.amount`]="{ item }">
        <span
          class="text-body-2 font-weight-medium"
          :class="item.amount >= 0 ? 'text-success' : 'text-error'"
        >
          {{ fmt.money(item.amount, currency) }}
        </span>
      </template>

      <!-- Boş durum süzgeci ayırt eder: "işlem yok" ile "süzgece uyan yok"
           farklı sorunlar; ikincisinde çıkış yolu (temizle) sunulur. -->
      <template #no-data>
        <AppEmptyState
          :icon="hasFilter ? 'mdi-filter-off-outline' : 'mdi-swap-horizontal'"
          :title="hasFilter ? t('walletDetail.noFilterMatch') : t('walletDetail.noTrns')"
          :action-text="hasFilter ? t('walletDetail.clearFilters') : undefined"
          action-icon="mdi-filter-off-outline"
          @action="clearFilters"
        />
      </template>
    </v-data-table-virtual>
  </v-sheet>
</template>

<style scoped>
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

.wallet-trns :deep(tbody tr) {
  cursor: pointer;
}

/* Süzgeç satırı: başlığın altında, aynı yüzeyde. Sabit yükseklik verilir ki
   kontrol yüksekliği satırı zorlamasın ve üstteki başlıkla altındaki ilk veri
   satırı birbirine binmesin. */
/* Sabit başlık zeminini Vuetify surface veriyor:
     .v-table--fixed-header ... thead > tr > th { background: rgb(var(--v-theme-surface)) }
   Bu tablo surface-light bir kartın İÇİNDE → başlık koyu (surface) kalıp ayrı bir
   bant gibi karttan kopuyordu. Kartla aynı tona (surface-light) çekilir → bant yok.
   !important ŞART: Vuetify'ın fixed-header kuralı daha yüksek özgüllükte, yoksa
   koyu varsayılan kazanır. Opak kalır (transparent DEĞİL) — altından satır kayar. */
.wallet-trns :deep(thead th),
.wallet-trns :deep(.trn-filters td) {
  background: rgb(var(--v-theme-surface-light)) !important;
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
