<script setup lang="ts">
import { useFormat } from '@/composables/useFormat'
import { ADJUSTMENT_ID } from '@/features/categories/pseudoCategories'
import { useTagsStore } from '@/features/tags/store'
import { useTrnsFormStore } from '@/features/trnForm/store'
import { useTrnsStore } from '@/features/trns/store'
import { TrnType } from '@/features/trns/types'

const props = defineProps<{ id: string }>()

const trnsStore = useTrnsStore()
const trnForm = useTrnsFormStore()
const tagsStore = useTagsStore()
const fmt = useFormat()

const full = computed(() => trnsStore.computeTrnItem(props.id))

// Etiketler: yalnız hâlâ var olan etiket id'lerini çipe dönüştür.
const tags = computed(() =>
  tagsStore.resolveIds(full.value?.tagIds).map(id => ({ id, ...tagsStore.items[id]! })),
)

const amountColor = computed(() => {
  const f = full.value
  if (!f)
    return undefined
  if (f.type === TrnType.Transfer)
    return 'medium-emphasis'
  if (f.categoryId === ADJUSTMENT_ID)
    return 'medium-emphasis'
  return f.type === TrnType.Income ? 'success' : 'error'
})

const amountText = computed(() => {
  const f = full.value
  if (!f)
    return ''
  if (f.type === TrnType.Transfer)
    return fmt.money(f.expenseAmount, f.expenseWallet.currency)
  const sign = f.type === TrnType.Income ? '+' : '-'
  return `${sign}${fmt.money(f.amount, f.wallet.currency)}`
})

const subtitle = computed(() => {
  const f = full.value
  if (!f)
    return ''
  if (f.type === TrnType.Transfer)
    return `${f.expenseWallet.name} → ${f.incomeWallet.name}`
  return f.wallet.name
})

const title = computed(() => {
  const f = full.value
  if (!f)
    return ''
  return f.categoryParent ? `${f.categoryParent.name} · ${f.category.name}` : f.category.name
})
</script>

<template>
  <v-list-item v-if="full" class="mb-1" @click="trnForm.openFormForEdit(id)">
    <template #prepend>
      <v-avatar :color="full.category.color || 'surface-variant'" size="38">
        <v-icon :icon="full.category.icon" color="white" size="20" />
      </v-avatar>
    </template>
    <v-list-item-title class="font-weight-medium">
      {{ title }}
    </v-list-item-title>
    <v-list-item-subtitle>{{ subtitle }}</v-list-item-subtitle>
    <div v-if="tags.length" class="d-flex flex-wrap ga-1 mt-1">
      <v-chip
        v-for="tag in tags" :key="tag.id"
        :color="tag.color" size="x-small" variant="flat" label
      >
        {{ tag.name }}
      </v-chip>
    </div>
    <template #append>
      <div class="text-body-1 font-weight-medium" :class="`text-${amountColor}`">
        {{ amountText }}
      </div>
    </template>
  </v-list-item>
</template>
