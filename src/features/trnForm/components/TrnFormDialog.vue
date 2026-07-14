<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { format } from 'date-fns'

import { useTrnsFormStore } from '@/features/trnForm/store'
import { useWalletsStore } from '@/features/wallets/store'
import { useCategoriesStore } from '@/features/categories/store'
import { useTagsStore } from '@/features/tags/store'
import { useTrnsStore } from '@/features/trns/store'
import { TrnType } from '@/features/trns/types'
import Calculator from '@/features/trnForm/components/Calculator.vue'
import TagFormDialog from '@/features/tags/components/TagFormDialog.vue'
import FormDrawer from '@/components/FormDrawer.vue'

const { t } = useI18n()
const store = useTrnsFormStore()
const walletsStore = useWalletsStore()
const categoriesStore = useCategoriesStore()
const tagsStore = useTagsStore()
const trnsStore = useTrnsStore()

const showTagForm = ref(false)
const confirmDelete = ref(false)

const isShow = computed({
  get: () => store.ui.isShow,
  set: (v: boolean) => { if (!v) store.onClose() },
})

const isEditing = computed(() => !!store.values.trnId)

const typeItems = computed(() => [
  { value: TrnType.Expense, label: t('trnForm.expense') },
  { value: TrnType.Income, label: t('trnForm.income') },
  { value: TrnType.Transfer, label: t('trnForm.transfer') },
])

const activeRaw = computed(() => store.values.amountRaw[store.activeAmountIdx] || '0')

const walletItems = computed(() =>
  walletsStore.sortedIds.map(id => ({ id, name: walletsStore.items?.[id]?.name ?? id, color: walletsStore.items?.[id]?.color })),
)

const categoryItems = computed(() =>
  categoriesStore.categoriesIdsForTrnValues.map(id => ({
    id, name: categoriesStore.items[id]?.name ?? id,
    icon: categoriesStore.items[id]?.icon, color: categoriesStore.items[id]?.color,
  })),
)

const dateStr = computed({
  get: () => format(store.values.date, 'yyyy-MM-dd'),
  set: (v: string) => {
    if (!v)
      return
    const [y, m, d] = v.split('-').map(Number)
    const dt = new Date(store.values.date)
    dt.setFullYear(y!, m! - 1, d!)
    store.values.date = dt.getTime()
  },
})

const isTransfer = computed(() => store.values.trnType === TrnType.Transfer)

function onDelete() {
  const id = store.values.trnId
  if (id)
    trnsStore.deleteTrn(id)
  confirmDelete.value = false
  store.onClose()
}
</script>

<template>
  <!-- Standart form drawer'ı (cüzdan/kategori/etiket ile aynı bileşen). -->
  <FormDrawer
    v-model="isShow"
    :title="isEditing ? t('trnForm.editTitle') : t('trnForm.newTitle')"
    :width="460"
    :deletable="isEditing"
    @save="store.submitAndSave()"
    @delete="confirmDelete = true"
  >
    <!-- Tür seçimi -->
    <v-btn-toggle
      :model-value="store.values.trnType"
      color="primary" mandatory rounded="lg" density="comfortable" class="mb-4 w-100"
      @update:model-value="store.onChangeTrnType($event)"
    >
      <v-btn v-for="it in typeItems" :key="it.value" :value="it.value" class="flex-grow-1">{{ it.label }}</v-btn>
    </v-btn-toggle>

    <!-- Tutar göstergesi -->
    <div class="text-center mb-4">
      <div class="text-h3 font-weight-bold">{{ activeRaw }}</div>
      <div v-if="store.shouldShowSum()" class="text-body-2 text-medium-emphasis">
        = {{ store.values.amount[store.activeAmountIdx] }}
      </div>
    </div>

    <!-- Transfer: cüzdanlar -->
    <template v-if="isTransfer">
      <div class="d-flex align-center ga-2 mb-4">
        <v-select
          :model-value="store.transferExpenseWalletId"
          :items="walletItems" item-title="name" item-value="id"
          :label="t('trnForm.from')" hide-details density="comfortable"
          @update:model-value="store.onTransferWalletSelected('expense', $event)"
        />
        <v-btn icon="mdi-swap-horizontal" variant="tonal" @click="store.switchTransferWallets()" />
        <v-select
          :model-value="store.transferIncomeWalletId"
          :items="walletItems" item-title="name" item-value="id"
          :label="t('trnForm.to')" hide-details density="comfortable"
          @update:model-value="store.onTransferWalletSelected('income', $event)"
        />
      </div>
      <v-btn-toggle
        v-if="!store.isSameCurrencyTransfer"
        :model-value="store.values.transferType"
        color="primary" mandatory rounded="lg" density="comfortable" class="mb-4 w-100"
        @update:model-value="store.onChangeTransferType($event)"
      >
        <v-btn value="expense" class="flex-grow-1">{{ t('trnForm.from') }}</v-btn>
        <v-btn value="income" class="flex-grow-1">{{ t('trnForm.to') }}</v-btn>
      </v-btn-toggle>
    </template>

    <!-- Gelir/Gider: cüzdan + kategori -->
    <template v-else>
      <div v-if="!walletItems.length" class="text-body-2 text-medium-emphasis mb-3">{{ t('trnForm.noWallets') }}</div>
      <v-chip-group
        :model-value="store.values.walletId"
        selected-class="text-primary" column class="mb-2"
        @update:model-value="store.values.walletId = $event"
      >
        <v-chip v-for="w in walletItems" :key="w.id" :value="w.id" filter>
          <v-icon icon="mdi-wallet-outline" :color="w.color" start size="16" />{{ w.name }}
        </v-chip>
      </v-chip-group>

      <div v-if="!categoryItems.length" class="text-body-2 text-medium-emphasis mb-3">{{ t('trnForm.noCategories') }}</div>
      <v-chip-group
        :model-value="store.values.categoryId"
        selected-class="text-primary" column class="mb-2"
        @update:model-value="store.values.categoryId = $event"
      >
        <v-chip v-for="c in categoryItems" :key="c.id" :value="c.id" filter>
          <v-icon :icon="c.icon" :color="c.color" start size="16" />{{ c.name }}
        </v-chip>
      </v-chip-group>
    </template>

    <!-- Etiketler (tags): çoklu seçim + satır içi yeni etiket -->
    <div class="d-flex align-center mb-1">
      <v-icon icon="$navTags" size="16" class="me-2 text-medium-emphasis" />
      <span class="text-body-2 text-medium-emphasis">{{ t('tags.title') }}</span>
    </div>
    <div class="d-flex align-center flex-wrap ga-2 mb-4">
      <v-chip
        v-for="id in tagsStore.sortedIds"
        :key="id"
        :color="tagsStore.items[id]?.color"
        :variant="store.values.tagIds.includes(id) ? 'flat' : 'outlined'"
        size="small"
        @click="store.toggleTag(id)"
      >
        <v-icon v-if="store.values.tagIds.includes(id)" icon="mdi-check" start size="14" />
        {{ tagsStore.items[id]?.name }}
      </v-chip>
      <v-chip size="small" variant="tonal" prepend-icon="mdi-plus" @click="showTagForm = true">
        {{ t('tags.add') }}
      </v-chip>
    </div>

    <!-- Tarih + açıklama -->
    <div class="d-flex ga-2 mb-4">
      <v-text-field v-model="dateStr" type="date" :label="t('trnForm.date')" hide-details density="comfortable" />
      <v-text-field v-model="store.values.desc" :label="t('trnForm.description')" hide-details density="comfortable" />
    </div>

    <!-- Hesap makinesi -->
    <Calculator @key="store.onClickCalculator($event)" />
  </FormDrawer>

  <!-- Satır içi yeni etiket oluşturma (kardeş panel) -->
  <TagFormDialog v-model="showTagForm" :tag-id="null" @created="store.toggleTag($event)" />

  <!-- Silme onayı (düzenleme modunda) -->
  <v-dialog v-model="confirmDelete" max-width="360">
    <v-card>
      <v-card-text>{{ t('trns.deleteConfirm') }}</v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="confirmDelete = false">{{ t('common.cancel') }}</v-btn>
        <v-btn color="error" variant="flat" @click="onDelete">{{ t('common.delete') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
