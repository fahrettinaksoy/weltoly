<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { useWalletsStore } from '@/features/wallets/store'
import { useTrnsStore } from '@/features/trns/store'
import { useCurrenciesStore } from '@/features/currencies/store'
import { useTagsStore } from '@/features/tags/store'
import { useFormat } from '@/composables/useFormat'
import TrnList from '@/features/trns/components/TrnList.vue'

const { t } = useI18n()
const walletsStore = useWalletsStore()
const trnsStore = useTrnsStore()
const currenciesStore = useCurrenciesStore()
const tagsStore = useTagsStore()
const fmt = useFormat()

// Panel etiket filtresi (boş = tümü).
const filterTagIds = ref<string[]>([])
function toggleFilterTag(id: string) {
  filterTagIds.value = filterTagIds.value.includes(id)
    ? filterTagIds.value.filter(t => t !== id)
    : [...filterTagIds.value, id]
}

const totalBalance = computed(() => {
  let sum = 0
  for (const id of walletsStore.sortedIds) {
    const w = walletsStore.itemsComputed[id]
    if (w && !w.isExcludeInTotal)
      sum += w.amount * (w.rate ?? 1)
  }
  return sum
})

const recentIds = computed(() =>
  trnsStore.getStoreTrnsIds({
    sort: true,
    tagsIds: filterTagIds.value.length ? filterTagIds.value : undefined,
  }).slice(0, 50),
)
</script>

<template>
  <div class="pa-4">
    <div class="d-flex align-center mb-4">
      <v-icon icon="mdi-view-dashboard-outline" size="28" class="me-3" color="primary" />
      <h1 class="text-h5 font-weight-bold">{{ t('dashboard.title') }}</h1>
    </div>

    <v-card color="primary" variant="flat" class="mb-4 pa-5">
      <div class="text-caption" style="opacity: 0.8;">{{ t('dashboard.totalBalance') }}</div>
      <div class="text-h4 font-weight-bold">{{ fmt.money(totalBalance, currenciesStore.base) }}</div>
    </v-card>

    <div class="text-subtitle-1 font-weight-medium mb-2">{{ t('dashboard.recentTrns') }}</div>

    <!-- Etiket filtresi -->
    <div v-if="tagsStore.hasItems" class="d-flex flex-wrap ga-2 mb-3">
      <v-chip
        v-for="id in tagsStore.sortedIds"
        :key="id"
        :color="tagsStore.items[id]?.color"
        :variant="filterTagIds.includes(id) ? 'flat' : 'outlined'"
        size="small"
        @click="toggleFilterTag(id)"
      >
        <v-icon v-if="filterTagIds.includes(id)" icon="mdi-check" start size="14" />
        {{ tagsStore.items[id]?.name }}
      </v-chip>
    </div>

    <TrnList v-if="recentIds.length" :ids="recentIds" />

    <v-card v-else variant="tonal" class="pa-8 text-center">
      <v-icon icon="mdi-note-plus-outline" size="48" class="mb-3 text-medium-emphasis" />
      <div class="text-body-2 text-medium-emphasis">{{ t('dashboard.noTrns') }}</div>
    </v-card>
  </div>
</template>
