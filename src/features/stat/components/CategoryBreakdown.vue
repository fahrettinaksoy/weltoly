<script setup lang="ts">
import { formatMoney } from '@/shared/lib/money'
import { useCategoriesStore } from '@/features/categories/store'
import { useCurrenciesStore } from '@/features/currencies/store'
import { useSettingsStore } from '@/stores/settings'
import type { BreakdownItem } from '@/features/stat/store'

defineProps<{ items: BreakdownItem[] }>()

const categoriesStore = useCategoriesStore()
const currenciesStore = useCurrenciesStore()
const settings = useSettingsStore()
</script>

<template>
  <div>
    <div v-for="it in items" :key="it.categoryId" class="mb-3">
      <div class="d-flex align-center mb-1">
        <v-avatar :color="categoriesStore.items[it.categoryId]?.color || 'surface-variant'" size="28" class="me-2">
          <v-icon :icon="categoriesStore.items[it.categoryId]?.icon" color="white" size="16" />
        </v-avatar>
        <span class="text-body-2">{{ categoriesStore.items[it.categoryId]?.name ?? it.categoryId }}</span>
        <v-spacer />
        <span class="text-body-2 font-weight-medium">
          {{ formatMoney(it.amount, currenciesStore.base, settings.locale) }}
        </span>
        <span class="text-caption text-medium-emphasis ms-2" style="min-width: 40px; text-align: right;">
          {{ Math.round(it.percent) }}%
        </span>
      </div>
      <v-progress-linear
        :model-value="it.percent"
        :color="categoriesStore.items[it.categoryId]?.color || 'primary'"
        height="6"
        rounded
      />
    </div>
  </div>
</template>
