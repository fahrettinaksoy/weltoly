<script setup lang="ts">
import type { CategoryId } from '@/features/categories/types'

import { useI18n } from 'vue-i18n'
import AppEmptyState from '@/components/AppEmptyState.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useAppBarAction } from '@/composables/useAppBarAction'
import CategoryFormDialog from '@/features/categories/components/CategoryFormDialog.vue'
import { useCategoriesStore } from '@/features/categories/store'
import { useTrnsStore } from '@/features/trns/store'

const { t } = useI18n()
const categoriesStore = useCategoriesStore()
const trnsStore = useTrnsStore()
const fmt = useFormat()

const showDialog = ref(false)
const editId = ref<CategoryId | null>(null)

const search = ref('')

/** Silme onayı bekleyen satır. null = dialog kapalı. */
const pendingDelete = ref<CategoryRow | null>(null)

/**
 * Silme onaylandı. Sonuç bildirimi (başarı/hata) store'un içinden merkezî
 * snackbar kuyruğuna düşer — sayfa bildirim bağlamaz.
 */
function confirmDelete() {
  const row = pendingDelete.value
  if (!row)
    return
  categoriesStore.deleteCategory(row.id)
  pendingDelete.value = null
}

function openNew() {
  editId.value = null
  showDialog.value = true
}
useAppBarAction(() => ({ icon: '$add', label: t('categories.add'), onClick: openNew }))

function openEdit(id: CategoryId) {
  editId.value = id
  showDialog.value = true
}

/**
 * Kategori başına DOĞRUDAN atanmış işlem sayısı (alt kategoriler toplanmaz).
 * Üst kategoriler doğrudan işlem almaz → 0 görünürler; bu doğrudur, onlar
 * yapısal ebeveyn. Toplasaydık üst + alt aynı işlemi iki kez sayardı ve
 * pay çubuklarının toplamı %100'ü aşardı.
 */
const usageById = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {}
  const trns = trnsStore.items
  if (!trns)
    return counts
  for (const trnId in trns) {
    const categoryId = trns[trnId]?.categoryId
    if (categoryId)
      counts[categoryId] = (counts[categoryId] ?? 0) + 1
  }
  return counts
})

interface CategoryRow {
  id: CategoryId
  name: string
  color: string
  icon: string
  desc: string
  parentId: CategoryId | null
  childCount: number
  quick: boolean
  usage: number
  share: number
}

/**
 * Satırlar kök → çocukları sırasıyla, yani AĞAÇ SIRASINDA kurulur; bir üst
 * kategorinin çocukları hemen onun altında gelir.
 * Bu kurulum sentetik 'transfer'/'adjustment' kategorilerini kendiliğinden
 * dışarıda bırakır (categoriesRootIds onları süzüyor) — items'ı doğrudan
 * gezseydik tabloya sızarlardı.
 */
const baseRows = computed(() => {
  const out: Omit<CategoryRow, 'share'>[] = []

  const push = (id: CategoryId, parentId: CategoryId | null, childCount: number) => {
    const c = categoriesStore.items[id]
    if (!c)
      return
    out.push({
      id,
      name: c.name,
      color: c.color,
      icon: c.icon,
      desc: c.desc,
      parentId,
      childCount,
      quick: c.showInQuickSelector,
      usage: usageById.value[id] ?? 0,
    })
  }

  /**
   * Kullanıma göre azalan sıralama — ama AĞAÇ İÇİNDE.
   * Kökler kendi aralarında, çocuklar da kendi ebeveynlerinin altında sıralanır.
   * Düz bir kolon sıralaması çocukları ebeveynlerinden koparırdı; bu yüzden
   * sıralama tablonun değil bu fonksiyonun işi (headers'ta sortable: false).
   * Roll-up: kökün ağırlığı = kendi + çocuklarının toplamı, yoksa işlem almayan
   * ebeveynler her zaman en alta düşer ve dolu dalları da beraberinde götürür.
   */
  const usage = (id: CategoryId) => usageById.value[id] ?? 0
  const byUsageThenName = (weight: (id: CategoryId) => number) =>
    (a: CategoryId, b: CategoryId) =>
      weight(b) - weight(a)
      || (categoriesStore.items[a]?.name ?? '').localeCompare(categoriesStore.items[b]?.name ?? '')

  const rootWeight = (rootId: CategoryId) =>
    usage(rootId) + categoriesStore.getChildrenIds(rootId).reduce((sum, c) => sum + usage(c), 0)

  const rootIds = [...categoriesStore.categoriesRootIds].sort(byUsageThenName(rootWeight))

  for (const rootId of rootIds) {
    const childIds = [...categoriesStore.getChildrenIds(rootId)].sort(byUsageThenName(usage))
    push(rootId, null, childIds.length)
    for (const childId of childIds)
      push(childId, rootId, 0)
  }
  return out
})

/** Açık üst kategoriler. Varsayılan: hepsi açık. */
const collapsed = ref(new Set<CategoryId>())

function toggle(id: CategoryId) {
  const next = new Set(collapsed.value)
  if (!next.delete(id))
    next.add(id)
  collapsed.value = next
}

const rootCount = computed(() => categoriesStore.categoriesRootIds.length)
const usedCount = computed(() => baseRows.value.filter(r => r.usage > 0).length)
const totalUsage = computed(() => baseRows.value.reduce((sum, r) => sum + r.usage, 0))
const usedRatio = computed(() => baseRows.value.length ? (usedCount.value / baseRows.value.length) * 100 : 0)

/** Tablo satırları: işlem sayısının toplam içindeki payı (%) burada eklenir. */
const rows = computed<CategoryRow[]>(() => baseRows.value.map(r => ({
  ...r,
  share: totalUsage.value ? (r.usage / totalUsage.value) * 100 : 0,
})))

/**
 * Görünen satırlar: kapalı bir üst kategorinin çocukları gizlenir.
 * Arama sırasında kapalılık yok sayılır — yoksa eşleşen bir alt kategori
 * kapalı ebeveyni yüzünden hiç bulunamazdı.
 */
const visibleRows = computed<CategoryRow[]>(() => {
  const searching = search.value.trim().length > 0
  return rows.value.filter(r =>
    !r.parentId || searching || !collapsed.value.has(r.parentId),
  )
})

/** Özet sayaçları: kategorilerde anlamlı olan yapı (kaç ana / kaç alt). */
const kpis = computed(() => [
  { key: 'total', label: t('categories.stats.total'), value: fmt.number(rows.value.length) },
  { key: 'root', label: t('categories.stats.root'), value: fmt.number(rootCount.value) },
  { key: 'child', label: t('categories.stats.child'), value: fmt.number(rows.value.length - rootCount.value) },
])

/** Donut'ta ayrı dilim olarak gösterilecek en çok işlem alan kategori sayısı. */
const PIE_LIMIT = 6

/**
 * Donut dilimleri: en çok işlem alan PIE_LIMIT kategori, kalanların toplamı tek
 * "Diğer" diliminde. Renk her kategorinin kendi rengi (VPie: item.color ?? palette).
 */
const pieItems = computed(() => {
  const used = rows.value.filter(r => r.usage > 0).toSorted((a, b) => b.usage - a.usage)
  const items = used.slice(0, PIE_LIMIT).map(r => ({
    key: r.id,
    title: r.name,
    value: r.usage,
    color: r.color,
  }))

  const restUsage = used.slice(PIE_LIMIT).reduce((sum, r) => sum + r.usage, 0)
  if (restUsage > 0) {
    items.push({
      key: '__rest',
      title: t('categories.chart.other', { count: used.length - PIE_LIMIT }),
      value: restUsage,
      color: 'grey',
    })
  }
  return items
})

/**
 * Kolonlar. Kolon sıralaması KAPALI: satır sırası ağacın kendisi.
 * Varsayılan sıralama (işleme göre azalan) baseRows'ta AĞAÇ İÇİNDE yapılır —
 * tabloya bıraksaydık çocukları ebeveynlerinden koparırdı.
 */
const headers = computed(() => [
  { title: t('categories.table.name'), key: 'name', sortable: false, width: 320, nowrap: true },
  { title: t('categories.description'), key: 'desc', sortable: false, width: 340, nowrap: true },
  { title: t('categories.table.usage'), key: 'usage', align: 'end', sortable: false, width: 260, nowrap: true },
  { title: '', key: 'actions', align: 'end', sortable: false, width: 104 },
] as const)

/** VDataTable @click:row → (event, { item }). Satıra tıklamak düzenlemeyi açar. */
function onRowClick(_event: unknown, { item }: { item: CategoryRow }) {
  openEdit(item.id)
}
</script>

<template>
  <div class="categories-page pa-4">
    <template v-if="categoriesStore.hasItems">
      <!-- Özet şeridi: tek satır. Asıl içerik tablo — özet ekranı yemesin.
           Donutun legend'i yok: tablo zaten renk rozeti + pay çubuğu gösteriyor. -->
      <v-sheet color="surface-light" class="d-flex align-center ga-6 pa-4 mb-3 flex-wrap flex-0-0">
        <!-- Hiç işlem yoksa donut anlamsız → gizle. -->
        <v-pie
          v-if="totalUsage > 0"
          :items="pieItems"
          :size="80"
          :inner-cut="64"
          :gap="2"
          rounded="2"
          tooltip
        >
          <template #center>
            <div class="text-body-2 font-weight-bold">
              {{ fmt.number(totalUsage) }}
            </div>
          </template>
        </v-pie>

        <div
          v-for="kpi in kpis"
          :key="kpi.key"
        >
          <div class="text-h5 font-weight-bold">
            {{ kpi.value }}
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ kpi.label }}
          </div>
        </div>

        <v-spacer />

        <div class="d-flex align-center ga-3">
          <div class="text-caption text-medium-emphasis">
            {{ t('categories.stats.usedRatio') }}
          </div>
          <v-progress-circular :model-value="usedRatio" :size="48" :width="5" color="primary">
            <span class="text-caption font-weight-bold">{{ fmt.percent(usedRatio) }}</span>
          </v-progress-circular>
        </div>
      </v-sheet>

      <!-- Arama. variant/density global-configuration'dan (defaults.ts) gelir;
           yuvarlaklığı --app-radius belirler. Eski sarmalayıcı v-sheet kaldırıldı:
           filled variant'ın alt çizgisini gizlemek içindi, outlined'da gereksiz. -->
      <v-text-field
        v-model="search"
        :placeholder="t('categories.search')"
        prepend-inner-icon="mdi-magnify"
        clearable
        class="mb-3 flex-0-0"
      />

      <!-- Ağaç tablosu: satırlar kök → çocuk sırasında, üst kategoride aç/kapa.
           Sayfalama yok: bir sayfa sınırı ebeveyni çocuklarından ayırırdı. -->
      <v-data-table-virtual
        :headers="headers"
        :items="visibleRows"
        :search="search"
        item-value="id"
        density="comfortable"
        hover
        fixed-header
        class="bg-transparent categories-table"
        @click:row="onRowClick"
      >
        <!-- Kategori: aç/kapa + ikon rozeti + ad (+ hızlı seçici yıldızı).
             Çocuklar girintili → ebeveynine ait olduğu görülsün. -->
        <template #[`item.name`]="{ item }">
          <div class="d-flex align-center ga-3 py-1" :class="{ 'ps-8': item.parentId }">
            <!-- Çocuğu olmayan satırlarda da buton RENDER EDİLİR, sadece görünmez:
                 böylece yerini korur ve ikon rozetleri hizada kalır. -->
            <v-btn
              :icon="collapsed.has(item.id) ? 'mdi-chevron-right' : 'mdi-chevron-down'"
              variant="text"
              size="x-small"
              :class="{ 'cat-toggle--placeholder': !item.childCount }"
              :disabled="!item.childCount"
              :aria-label="item.name"
              :aria-expanded="!collapsed.has(item.id)"
              @click.stop="toggle(item.id)"
            />

            <v-avatar :color="item.color" size="32">
              <v-icon :icon="item.icon" color="white" size="18" />
            </v-avatar>
            <span class="font-weight-medium">{{ item.name }}</span>

            <v-chip v-if="item.childCount" size="x-small" variant="tonal">
              {{ fmt.number(item.childCount) }}
            </v-chip>
            <v-icon
              v-if="item.quick"
              icon="mdi-star"
              color="warning"
              size="16"
              :aria-label="t('categories.showInQuickSelector')"
            />
          </div>
        </template>

        <!-- Açıklama: boşsa satırı kalabalıklaştırma, sönük tire koy -->
        <template #[`item.desc`]="{ item }">
          <span v-if="item.desc" class="text-body-2 text-medium-emphasis">{{ item.desc }}</span>
          <span v-else class="text-disabled">—</span>
        </template>

        <!-- İşlem: sayı + toplam içindeki payı gösteren çubuk -->
        <template #[`item.usage`]="{ item }">
          <div v-if="item.usage" class="d-flex align-center ga-3 justify-end">
            <v-progress-linear
              :model-value="item.share"
              :color="item.color"
              height="6"
              rounded
              class="categories-share"
            />
            <span class="text-body-2 font-weight-medium categories-usage-num">
              {{ fmt.number(item.usage) }}
            </span>
          </div>
          <div v-else class="d-flex align-center ga-2 justify-end text-disabled">
            <v-icon icon="mdi-circle-off-outline" size="16" />
            <span class="text-caption">{{ t('categories.unused') }}</span>
          </div>
        </template>

        <template #[`item.actions`]="{ item }">
          <div class="d-flex justify-end">
            <v-btn
              icon="mdi-pencil-outline"
              variant="text"
              size="small"
              :aria-label="t('categories.edit')"
              @click.stop="openEdit(item.id)"
            />
            <v-btn
              icon="mdi-trash-can-outline"
              variant="text"
              size="small"
              color="error"
              :aria-label="t('common.delete')"
              @click.stop="pendingDelete = item"
            />
          </div>
        </template>

        <template #no-data>
          <AppEmptyState icon="mdi-shape-outline" :title="t('categories.noResults')" />
        </template>
      </v-data-table-virtual>
    </template>

    <!-- Boş durum -->
    <AppEmptyState
      v-else
      icon="mdi-shape-plus-outline"
      :title="t('categories.empty')"
      :text="t('categories.emptyHint')"
      :action-text="t('categories.add')"
      action-icon="mdi-plus"
      @action="openNew"
    />

    <CategoryFormDialog v-model="showDialog" :category-id="editId" />

    <ConfirmDialog
      :model-value="!!pendingDelete"
      :title="pendingDelete?.name"
      :message="t('categories.deleteConfirm')"
      @update:model-value="pendingDelete = null"
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
/* Sayfa, kartın verdiği yüksekliği tam doldurur: özet + arama sabit,
   kalan alanın tamamı tabloya gider (kart 100dvh tabanlı → tablo ekranı baz alır). */
.categories-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
}

/* min-height:0 şart: flex öğesi varsayılan olarak içeriğinden kısalmaz,
   o zaman tablo taşar ve iç kaydırma hiç oluşmaz. */
.categories-table {
  flex: 1 1 auto;
  min-height: 0;
}

/* Satır tıklanabilir (düzenlemeyi açar) — imleç bunu belli etsin. */
.categories-table :deep(tbody tr) {
  cursor: pointer;
}

/* Aç/kapa butonu yoksa yerini SABİT GENİŞLİKLİ bir div ile doldurmak hizayı bozar:
   Vuetify'da ikon butonun genişliği .v-btn--icon.v-btn--density-default kuralıyla
   calc(--v-btn-height + 12px) = 32px'tir; elle yazılan her sayı er ya da geç kayar
   (nitekim 20px yazılmıştı ve rozetler 12px kaymıştı).
   Onun yerine butonun kendisi görünmez kılınır → genişlik tanım gereği birebir eşleşir.
   visibility:hidden ayrıca öğeyi erişilebilirlik ağacından ve odak sırasından çıkarır. */
.cat-toggle--placeholder {
  visibility: hidden;
}

/* Pay çubuğu ve sayı sabit genişlik: satırlar arasında hizalı okunsun. */
.categories-share {
  width: 120px;
  flex: 0 0 auto;
}
.categories-usage-num {
  min-width: 32px;
  text-align: end;
}
</style>
