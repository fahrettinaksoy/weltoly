<script setup lang="ts">
import type { TagId } from '@/features/tags/types'

import { useI18n } from 'vue-i18n'
import AppEmptyState from '@/components/AppEmptyState.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useAppBarAction } from '@/composables/useAppBarAction'
import TagFormDialog from '@/features/tags/components/TagFormDialog.vue'
import { useTagsStore } from '@/features/tags/store'
import { useTrnsStore } from '@/features/trns/store'

const { t } = useI18n()
const tagsStore = useTagsStore()
const trnsStore = useTrnsStore()
const fmt = useFormat()

const showDialog = ref(false)
const editId = ref<TagId | null>(null)

const search = ref('')

/** Silme onayı bekleyen satır. null = dialog kapalı. */
const pendingDelete = ref<TagRow | null>(null)

/**
 * Silme onaylandı. Sonuç bildirimi (başarı/hata) store'un içinden merkezî
 * snackbar kuyruğuna düşer — sayfa bildirim bağlamaz.
 */
function confirmDelete() {
  const row = pendingDelete.value
  if (!row)
    return
  tagsStore.deleteTag(row.id)
  pendingDelete.value = null
}

function openNew() {
  editId.value = null
  showDialog.value = true
}
useAppBarAction(() => ({ icon: '$add', label: t('tags.add'), onClick: openNew }))

function openEdit(id: TagId) {
  editId.value = id
  showDialog.value = true
}

/** VDataTable @click:row → (event, { item }). Satıra tıklamak düzenlemeyi açar. */
function onRowClick(_event: unknown, { item }: { item: TagRow }) {
  openEdit(item.id)
}

/** Etiket başına kullanım sayısı: tüm işlemlerin tagIds'i tek geçişte sayılır. */
const usageById = computed<Record<TagId, number>>(() => {
  const counts: Record<TagId, number> = {}
  const trns = trnsStore.items
  if (!trns)
    return counts
  for (const trnId in trns) {
    for (const tagId of trns[trnId]?.tagIds ?? [])
      counts[tagId] = (counts[tagId] ?? 0) + 1
  }
  return counts
})

interface TagRow { id: TagId, name: string, color: string, desc: string, usage: number, share: number }

const baseRows = computed(() => tagsStore.sortedIds.map(id => ({
  id,
  name: tagsStore.items[id]?.name ?? '',
  color: tagsStore.items[id]?.color ?? 'primary',
  desc: tagsStore.items[id]?.desc ?? '',
  usage: usageById.value[id] ?? 0,
})))

const usedCount = computed(() => baseRows.value.filter(r => r.usage > 0).length)
const totalUsage = computed(() => baseRows.value.reduce((sum, r) => sum + r.usage, 0))

/** Tablo satırları: kullanımın toplam içindeki payı (%) burada eklenir. */
const rows = computed<TagRow[]>(() => baseRows.value.map(r => ({
  ...r,
  share: totalUsage.value ? (r.usage / totalUsage.value) * 100 : 0,
})))
const usedRatio = computed(() => rows.value.length ? (usedCount.value / rows.value.length) * 100 : 0)

/** Özet sayaçları. */
const kpis = computed(() => [
  { key: 'total', label: t('tags.stats.total'), value: fmt.number(rows.value.length) },
  { key: 'used', label: t('tags.stats.used'), value: fmt.number(usedCount.value) },
  { key: 'unused', label: t('tags.stats.unused'), value: fmt.number(rows.value.length - usedCount.value) },
])

/** Donut'ta ayrı dilim olarak gösterilecek en çok kullanılan etiket sayısı. */
const PIE_LIMIT = 6

/**
 * Donut dilimleri: en çok kullanılan PIE_LIMIT etiket, kalanların toplamı tek
 * "Diğer" diliminde. Renk her etiketin kendi rengi (VPie: item.color ?? palette).
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
      title: t('tags.chart.other', { count: used.length - PIE_LIMIT }),
      value: restUsage,
      color: 'grey',
    })
  }
  return items
})

/**
 * Tablo kolonları. Sıralama/filtreleme VDataTable'a bırakıldı — ayrı bir
 * sıralama düğmesi kolon başlıklarıyla çakışırdı.
 * 'share' ayrı kolon değil, kullanım kolonunun içinde çubuk olarak gösterilir.
 */
const headers = computed(() => [
  { title: t('tags.table.name'), key: 'name', sortable: true, width: 240, nowrap: true },
  { title: t('tags.description'), key: 'desc', sortable: true, width: 340, nowrap: true },
  { title: t('tags.table.usage'), key: 'usage', align: 'end', sortable: true, width: 260, nowrap: true },
  { title: '', key: 'actions', align: 'end', sortable: false, width: 104 },
] as const)
</script>

<template>
  <div class="tags-page pa-4">
    <!-- Yükleniyor: boş durumdan ÖNCE. Store'lar items=null ile başlıyor ve ilk
         SQLite turu dönene kadar öyle kalıyor; bu null "kayıt yok" sanılıp
         yükleme sırasında "henüz etiket yok + Ekle" gösteriliyordu. `isLoaded`
         dört store'da vardı ama hiçbir bileşende okunmuyordu. -->
    <v-skeleton-loader
      v-if="!tagsStore.isLoaded"
      type="heading, table-heading, list-item-two-line@6"
      class="bg-transparent"
    />

    <template v-else-if="tagsStore.hasItems">
      <!-- Özet: TEK satırlık şerit. Sayfanın asıl içeriği tablo — özet ekranı
           yemesin. Donutun legend'i yok: tablo kullanıma göre sıralı ve her
           satırda renk rozeti + pay çubuğu var, legend'i o üstleniyor. -->
      <v-sheet color="surface-light" class="d-flex align-center ga-6 pa-4 mb-3 flex-wrap flex-0-0">
        <!-- Dağılım. Hiç kullanım yoksa donut anlamsız → gizle. -->
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

        <!-- Kullanım oranı: halka (sayaçların yanında çubuktan daha kompakt) -->
        <div class="d-flex align-center ga-3">
          <div class="text-caption text-medium-emphasis">
            {{ t('tags.stats.usedRatio') }}
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
        :placeholder="t('tags.search')"
        prepend-inner-icon="mdi-magnify"
        clearable
        class="mb-3 flex-0-0"
      />

      <!-- Tablo. Sıralama + arama filtresi VDataTable'ın kendi işi. -->
      <v-data-table-virtual
        :headers="headers"
        :items="rows"
        :search="search"
        item-value="id"
        density="comfortable"
        hover
        fixed-header
        class="bg-transparent tags-table"
        :sort-by="[{ key: 'usage', order: 'desc' }]"
        @click:row="onRowClick"
      >
        <!-- Etiket: renk rozeti + ad -->
        <template #[`item.name`]="{ item }">
          <div class="d-flex align-center ga-3 py-1">
            <v-avatar :color="item.color" size="32">
              <v-icon icon="mdi-tag" color="white" size="18" />
            </v-avatar>
            <span class="font-weight-medium">{{ item.name }}</span>
          </div>
        </template>

        <!-- Açıklama: boşsa satırı kalabalıklaştırma, sönük tire koy -->
        <template #[`item.desc`]="{ item }">
          <span v-if="item.desc" class="text-body-2 text-medium-emphasis">{{ item.desc }}</span>
          <span v-else class="text-disabled">—</span>
        </template>

        <!-- Kullanım: sayı + toplam içindeki payı gösteren çubuk -->
        <template #[`item.usage`]="{ item }">
          <div v-if="item.usage" class="d-flex align-center ga-3 justify-end">
            <v-progress-linear
              :model-value="item.share"
              :color="item.color"
              height="6"
              rounded
              class="tags-share"
            />
            <span class="text-body-2 font-weight-medium tags-usage-num">
              {{ fmt.number(item.usage) }}
            </span>
          </div>
          <div v-else class="d-flex align-center ga-2 justify-end text-disabled">
            <v-icon icon="mdi-tag-off-outline" size="16" />
            <span class="text-caption">{{ t('tags.unused') }}</span>
          </div>
        </template>

        <template #[`item.actions`]="{ item }">
          <div class="d-flex justify-end">
            <v-btn
              icon="mdi-pencil-outline"
              variant="text"
              size="small"
              :aria-label="t('tags.editTitle')"
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

        <!-- Aramaya karşılık gelen etiket yok -->
        <template #no-data>
          <AppEmptyState icon="mdi-tag-search-outline" :title="t('tags.noResults')" />
        </template>
      </v-data-table-virtual>
    </template>

    <!-- Boş durum -->
    <AppEmptyState
      v-else
      icon="mdi-tag-multiple-outline"
      :title="t('tags.empty')"
      :text="t('tags.emptyHint')"
      :action-text="t('tags.add')"
      action-icon="mdi-plus"
      @action="openNew"
    />

    <TagFormDialog v-model="showDialog" :tag-id="editId" />

    <ConfirmDialog
      :model-value="!!pendingDelete"
      :title="pendingDelete?.name"
      :message="t('tags.deleteConfirm')"
      @update:model-value="pendingDelete = null"
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
/* Yuvarlaklık artık global kuraldan gelir (app.css → .v-sheet + --app-radius). */

/* Sayfa, kartın verdiği yüksekliği tam doldurur: özet + arama sabit,
   kalan alanın tamamı tabloya gider. Kart zaten 100dvh tabanlı
   (DefaultLayout → .page-hero-card), yani tablo ekran yüksekliğini baz alır. */
.tags-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
}

/* min-height:0 şart: flex öğesi varsayılan olarak içeriğinden kısalmaz,
   o zaman tablo taşar ve iç kaydırma hiç oluşmaz. */
.tags-table {
  flex: 1 1 auto;
  min-height: 0;
}

/* Sabit başlık satırı saydam olamaz (altından satır geçecek) — kart yüzeyiyle
   aynı tonu alsın; VTable varsayılanı 'surface' zaten kartın rengi. */

/* Satır tıklanabilir (düzenlemeyi açar) — imleç bunu belli etsin. */
.tags-table :deep(tbody tr) {
  cursor: pointer;
}

/* Pay çubuğu sabit genişlik: satırlar arasında hizalı okunsun. */
.tags-share {
  width: 120px;
  flex: 0 0 auto;
}

/* Sayı sütunu sabit genişlik: çubuklar aynı hizada bitsin. */
.tags-usage-num {
  min-width: 32px;
  text-align: end;
}
</style>
