<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { generateId } from '@/shared/lib/generateId'
import { random } from '@/shared/lib/random'
import { colorsArray } from '@/features/color/colors'
import { allCurrencies } from '@/features/currencies/list'
import { walletItemSchema, walletTypes, type WalletItem, type WalletType } from '@/features/wallets/types'
import { walletTypeIcon } from '@/features/wallets/walletMeta'
import { useWalletsStore } from '@/features/wallets/store'
import { useTrnsStore } from '@/features/trns/store'
import { TrnType } from '@/features/trns/types'
import FormDrawer from '@/components/FormDrawer.vue'
import ColorSwatches from '@/components/ColorSwatches.vue'

const props = defineProps<{
  modelValue: boolean
  walletId: string | null
}>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const { t } = useI18n()
const walletsStore = useWalletsStore()
const trnsStore = useTrnsStore()

const isEdit = computed(() => !!props.walletId)
const confirmDelete = ref(false)

// Renk seçici için sadeleştirilmiş palet (colorsArray'den örnek).
const palette = colorsArray.filter((_, i) => i % 6 === 0)

const currencyItems = allCurrencies.map(c => ({ code: c.code, title: `${c.code} — ${c.name}` }))

type FormState = {
  name: string
  type: WalletType
  currency: string
  color: string
  desc: string
  creditLimit: number
  isWithdrawal: boolean
  isExcludeInTotal: boolean
  isArchived: boolean
  order: number
}

function blankForm(): FormState {
  return {
    name: '', type: 'cash', currency: 'USD', color: random(colorsArray), desc: '',
    creditLimit: 0, isWithdrawal: false, isExcludeInTotal: false, isArchived: false, order: 0,
  }
}

const form = reactive<FormState>(blankForm())

const typeItems = computed(() =>
  walletTypes.map(type => ({ value: type, title: t(`wallets.types.${type}`), icon: walletTypeIcon[type] })),
)

function loadForm() {
  if (props.walletId && walletsStore.items?.[props.walletId]) {
    const w = walletsStore.items[props.walletId]!
    Object.assign(form, {
      name: w.name, type: w.type, currency: w.currency, color: w.color, desc: w.desc,
      creditLimit: w.type === 'credit' ? w.creditLimit : 0,
      isWithdrawal: w.isWithdrawal, isExcludeInTotal: w.isExcludeInTotal, isArchived: w.isArchived,
      order: w.order,
    })
  }
  else {
    Object.assign(form, blankForm())
  }
}

watch(() => props.modelValue, (open) => {
  if (open)
    loadForm()
})

const isValid = computed(() => form.name.trim().length > 0 && form.currency.trim().length > 0)

function close() {
  emit('update:modelValue', false)
}

function save() {
  const base = {
    name: form.name.trim(), currency: form.currency.trim().toUpperCase(), color: form.color,
    desc: form.desc, isWithdrawal: form.isWithdrawal, isExcludeInTotal: form.isExcludeInTotal,
    isArchived: form.isArchived, order: form.order, updatedAt: Date.now(),
  }
  const values = form.type === 'credit'
    ? { ...base, type: 'credit' as const, creditLimit: Number(form.creditLimit) || 0 }
    : { ...base, type: form.type }

  const parsed = walletItemSchema.safeParse(values)
  if (!parsed.success)
    return

  const id = props.walletId ?? generateId()
  walletsStore.saveWallet({ id, values: parsed.data as WalletItem })
  close()
}

/** Bu cüzdana referans veren işlem id'leri (silmede birlikte silinir). */
function referencingTrnIds(walletId: string): string[] {
  const trns = trnsStore.items
  if (!trns)
    return []
  const ids: string[] = []
  for (const id in trns) {
    const trn = trns[id]!
    const match = trn.type === TrnType.Transfer
      ? trn.expenseWalletId === walletId || trn.incomeWalletId === walletId
      : trn.walletId === walletId
    if (match)
      ids.push(id)
  }
  return ids
}

function remove() {
  if (!props.walletId)
    return
  walletsStore.deleteWallet(props.walletId, referencingTrnIds(props.walletId))
  confirmDelete.value = false
  close()
}
</script>

<template>
  <FormDrawer
    :model-value="modelValue"
    :title="isEdit ? t('wallets.edit') : t('wallets.add')"
    :deletable="isEdit"
    :save-disabled="!isValid"
    :width="480"
    @update:model-value="emit('update:modelValue', $event)"
    @save="save"
    @delete="confirmDelete = true"
  >
    <v-text-field
      v-model="form.name"
      :label="t('wallets.name')"
      autofocus
      class="mb-2"
    />

        <v-select
          v-model="form.type"
          :items="typeItems"
          :label="t('wallets.type')"
          class="mb-2"
        >
          <template #selection="{ item }">
            <v-icon :icon="walletTypeIcon[form.type]" size="20" class="me-2" />
            {{ item.title }}
          </template>
          <template #item="{ item, props: itemProps }">
            <v-list-item v-bind="itemProps" :prepend-icon="item.raw.icon" />
          </template>
        </v-select>

        <v-autocomplete
          v-model="form.currency"
          :items="currencyItems"
          item-title="title"
          item-value="code"
          :label="t('wallets.currency')"
          class="mb-2"
        />

        <v-text-field
          v-if="form.type === 'credit'"
          v-model.number="form.creditLimit"
          type="number"
          :label="t('wallets.creditLimit')"
          class="mb-2"
        />

        <div class="text-body-2 text-medium-emphasis mb-1">{{ t('wallets.color') }}</div>
        <ColorSwatches v-model="form.color" :colors="palette" class="mb-3" />

        <v-textarea
          v-model="form.desc"
          :label="t('wallets.description')"
          rows="2"
          auto-grow
          class="mb-2"
        />

    <v-switch v-model="form.isWithdrawal" :label="t('wallets.withdrawal')" color="primary" density="compact" hide-details />
    <v-switch v-model="form.isExcludeInTotal" :label="t('wallets.excludeInTotal')" color="primary" density="compact" hide-details />
    <v-switch v-model="form.isArchived" :label="t('wallets.archived')" color="primary" density="compact" hide-details />
  </FormDrawer>

  <v-dialog v-model="confirmDelete" max-width="360">
    <v-card>
      <v-card-text>{{ t('wallets.deleteConfirm') }}</v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="confirmDelete = false">{{ t('common.cancel') }}</v-btn>
        <v-btn color="error" variant="flat" @click="remove">{{ t('common.delete') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
