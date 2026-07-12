<script setup lang="ts">
import { formatMoney } from '@/shared/lib/money'
import { useTrnsStore } from '@/features/trns/store'
import { useTrnsFormStore } from '@/features/trnForm/store'
import { useSettingsStore } from '@/stores/settings'
import { TrnType } from '@/features/trns/types'

const props = defineProps<{ id: string }>()

const trnsStore = useTrnsStore()
const trnForm = useTrnsFormStore()
const settings = useSettingsStore()

const full = computed(() => trnsStore.computeTrnItem(props.id))

const amountColor = computed(() => {
  const f = full.value
  if (!f)
    return undefined
  if (f.type === TrnType.Transfer)
    return 'medium-emphasis'
  if (f.categoryId === 'adjustment')
    return 'medium-emphasis'
  return f.type === TrnType.Income ? 'success' : 'error'
})

const amountText = computed(() => {
  const f = full.value
  if (!f)
    return ''
  if (f.type === TrnType.Transfer)
    return formatMoney(f.expenseAmount, f.expenseWallet.currency, settings.locale)
  const sign = f.type === TrnType.Income ? '+' : '-'
  return `${sign}${formatMoney(f.amount, f.wallet.currency, settings.locale)}`
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
  <v-list-item v-if="full" rounded="lg" class="mb-1" @click="trnForm.openFormForEdit(id)">
    <template #prepend>
      <v-avatar :color="full.category.color || 'surface-variant'" size="38">
        <v-icon :icon="full.category.icon" color="white" size="20" />
      </v-avatar>
    </template>
    <v-list-item-title class="font-weight-medium">{{ title }}</v-list-item-title>
    <v-list-item-subtitle>{{ subtitle }}</v-list-item-subtitle>
    <template #append>
      <div class="text-body-1 font-weight-medium" :class="`text-${amountColor}`">{{ amountText }}</div>
    </template>
  </v-list-item>
</template>
