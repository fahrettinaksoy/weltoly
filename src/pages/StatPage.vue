<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { format } from 'date-fns'

import { useStatStore, type StatType } from '@/features/stat/store'
import { useCurrenciesStore } from '@/features/currencies/store'
import { useWalletsStore } from '@/features/wallets/store'
import { useTagsStore } from '@/features/tags/store'
import type { Period } from '@/features/date/types'
import StatChart from '@/features/stat/components/StatChart.vue'
import CategoryBreakdown from '@/features/stat/components/CategoryBreakdown.vue'
import { useFormat } from '@/composables/useFormat'

const { t } = useI18n()
const stat = useStatStore()
const currenciesStore = useCurrenciesStore()
const walletsStore = useWalletsStore()
const tagsStore = useTagsStore()
const fmt = useFormat()

const walletFilterItems = computed(() =>
  walletsStore.sortedIds.map(id => ({ id, name: walletsStore.items?.[id]?.name ?? id })),
)

const tagFilterItems = computed(() =>
  tagsStore.sortedIds.map(id => ({ id, name: tagsStore.items[id]?.name ?? id })),
)

const periods: { value: Period, label: string }[] = [
  { value: 'day', label: t('stat.day') },
  { value: 'week', label: t('stat.week') },
  { value: 'month', label: t('stat.month') },
  { value: 'year', label: t('stat.year') },
]

const rangeLabel = computed(() => {
  const { start, end } = stat.currentRange
  switch (stat.period) {
    case 'day': return format(start, 'd MMMM yyyy')
    case 'week': return `${format(start, 'd MMM')} – ${format(end, 'd MMM')}`
    case 'month': return format(start, 'MMMM yyyy')
    case 'year': return format(start, 'yyyy')
  }
})
</script>

<template>
  <div class="pa-4">
    <!-- Periyot seçimi -->
    <v-btn-toggle
      :model-value="stat.period"
      color="primary" mandatory rounded="lg" density="comfortable" class="mb-3 w-100"
      @update:model-value="stat.setPeriod($event as Period)"
    >
      <v-btn v-for="p in periods" :key="p.value" :value="p.value" class="flex-grow-1">{{ p.label }}</v-btn>
    </v-btn-toggle>

    <!-- Cüzdan filtresi -->
    <v-select
      v-if="walletFilterItems.length"
      :model-value="stat.filterWalletIds"
      :items="walletFilterItems"
      item-title="name" item-value="id"
      :label="t('stat.filterWallets')"
      multiple chips closable-chips clearable hide-details density="comfortable" class="mb-3"
      @update:model-value="stat.setFilterWalletIds($event)"
    />

    <!-- Etiket filtresi -->
    <v-select
      v-if="tagFilterItems.length"
      :model-value="stat.filterTagIds"
      :items="tagFilterItems"
      item-title="name" item-value="id"
      :label="t('stat.filterTags')"
      multiple chips closable-chips clearable hide-details density="comfortable" class="mb-3"
      @update:model-value="stat.setFilterTagIds($event)"
    />

    <!-- Aralık navigasyonu -->
    <div class="d-flex align-center justify-space-between mb-3">
      <v-btn icon="mdi-chevron-left" variant="tonal" size="small" @click="stat.prev()" />
      <span class="text-subtitle-1 font-weight-medium">{{ rangeLabel }}</span>
      <v-btn icon="mdi-chevron-right" variant="tonal" size="small" :disabled="stat.offset >= 0" @click="stat.next()" />
    </div>

    <!-- Özet -->
    <v-card variant="tonal" class="mb-4 pa-4">
      <div class="d-flex justify-space-between">
        <div>
          <div class="text-caption text-medium-emphasis">{{ t('trnForm.income') }}</div>
          <div class="text-subtitle-1 font-weight-bold text-success">{{ fmt.money(stat.summary.income, currenciesStore.base) }}</div>
        </div>
        <div class="text-center">
          <div class="text-caption text-medium-emphasis">{{ t('trnForm.expense') }}</div>
          <div class="text-subtitle-1 font-weight-bold text-error">{{ fmt.money(stat.summary.expense, currenciesStore.base) }}</div>
        </div>
        <div class="text-right">
          <div class="text-caption text-medium-emphasis">{{ t('stat.balance') }}</div>
          <div class="text-subtitle-1 font-weight-bold">{{ fmt.money(stat.summary.sum, currenciesStore.base) }}</div>
        </div>
      </div>
    </v-card>

    <!-- Grafik -->
    <v-card variant="tonal" class="mb-4 pa-2">
      <StatChart :series="stat.series" :period="stat.period" />
    </v-card>

    <!-- Kırılım -->
    <div class="d-flex align-center mb-3">
      <span class="text-subtitle-1 font-weight-medium">{{ t('stat.breakdown') }}</span>
      <v-spacer />
      <v-btn-toggle
        :model-value="stat.statType"
        color="primary" mandatory rounded="lg" density="compact"
        @update:model-value="stat.setStatType($event as StatType)"
      >
        <v-btn value="expense" size="small">{{ t('trnForm.expense') }}</v-btn>
        <v-btn value="income" size="small">{{ t('trnForm.income') }}</v-btn>
      </v-btn-toggle>
    </div>

    <CategoryBreakdown v-if="stat.breakdown.length" :items="stat.breakdown" />
    <v-card v-else variant="tonal" class="pa-6 text-center">
      <div class="text-body-2 text-medium-emphasis">{{ t('stat.noData') }}</div>
    </v-card>
  </div>
</template>
