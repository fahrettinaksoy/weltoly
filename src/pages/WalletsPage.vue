<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { formatMoney } from '@/shared/lib/money'
import { walletTypeIcon } from '@/features/wallets/walletMeta'
import { useWalletsStore } from '@/features/wallets/store'
import { useCurrenciesStore } from '@/features/currencies/store'
import { useSettingsStore } from '@/stores/settings'
import WalletFormDialog from '@/features/wallets/components/WalletFormDialog.vue'

const { t } = useI18n()
const walletsStore = useWalletsStore()
const currenciesStore = useCurrenciesStore()
const settings = useSettingsStore()

const showDialog = ref(false)
const editId = ref<string | null>(null)

function openNew() {
  editId.value = null
  showDialog.value = true
}
function openEdit(id: string) {
  editId.value = id
  showDialog.value = true
}

const total = computed(() => {
  let sum = 0
  for (const id of walletsStore.sortedIds) {
    const w = walletsStore.itemsComputed[id]
    if (w && !w.isExcludeInTotal)
      sum += w.amount * (w.rate ?? 1)
  }
  return sum
})
</script>

<template>
  <div class="pa-4">
    <div class="d-flex align-center mb-4">
      <v-icon icon="mdi-wallet-outline" size="28" class="me-3" color="primary" />
      <h1 class="text-h5 font-weight-bold">{{ t('wallets.title') }}</h1>
      <v-spacer />
      <v-btn icon="mdi-plus" color="primary" variant="flat" size="small" @click="openNew" />
    </div>

    <!-- Toplam -->
    <v-card v-if="walletsStore.hasItems" variant="tonal" class="mb-4 pa-4">
      <div class="text-caption text-medium-emphasis">{{ t('wallets.total') }}</div>
      <div class="text-h5 font-weight-bold">{{ formatMoney(total, currenciesStore.base, settings.locale) }}</div>
    </v-card>

    <!-- Liste -->
    <v-list v-if="walletsStore.hasItems" class="bg-transparent" lines="two">
      <v-list-item
        v-for="id in walletsStore.sortedIds"
        :key="id"
        rounded="lg"
        class="mb-2"
        :style="{ opacity: walletsStore.itemsComputed[id]?.isArchived ? 0.5 : 1 }"
        @click="openEdit(id)"
      >
        <template #prepend>
          <v-avatar :color="walletsStore.itemsComputed[id]?.color" size="40">
            <v-icon :icon="walletTypeIcon[walletsStore.itemsComputed[id]!.type]" color="white" />
          </v-avatar>
        </template>

        <v-list-item-title class="font-weight-medium">
          {{ walletsStore.itemsComputed[id]?.name }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{ t(`wallets.types.${walletsStore.itemsComputed[id]?.type}`) }}
        </v-list-item-subtitle>

        <template #append>
          <div class="text-body-1 font-weight-medium">
            {{ formatMoney(walletsStore.itemsComputed[id]?.amount ?? 0, walletsStore.itemsComputed[id]!.currency, settings.locale) }}
          </div>
        </template>
      </v-list-item>
    </v-list>

    <!-- Boş durum -->
    <v-card v-else variant="tonal" class="pa-8 text-center">
      <v-icon icon="mdi-wallet-plus-outline" size="56" class="mb-4 text-medium-emphasis" />
      <div class="text-body-1 mb-1">{{ t('wallets.empty') }}</div>
      <div class="text-body-2 text-medium-emphasis mb-4">{{ t('wallets.emptyHint') }}</div>
      <v-btn color="primary" variant="flat" prepend-icon="mdi-plus" @click="openNew">
        {{ t('wallets.add') }}
      </v-btn>
    </v-card>

    <WalletFormDialog v-model="showDialog" :wallet-id="editId" />
  </div>
</template>
