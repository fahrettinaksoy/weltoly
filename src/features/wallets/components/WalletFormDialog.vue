<script setup lang="ts">
import type { WalletItem, WalletType } from '@/features/wallets/types'

import { useI18n } from 'vue-i18n'
import ColorSwatches from '@/components/ColorSwatches.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import FormDrawer from '@/components/FormDrawer.vue'
import IconPicker from '@/components/IconPicker.vue'
import { colorsArray } from '@/features/color/colors'
import { allCurrencies } from '@/features/currencies/list'
import { useUserStore } from '@/features/user/store'
import { useWalletsStore } from '@/features/wallets/store'
import { walletItemSchema, walletTypes } from '@/features/wallets/types'
import { walletIcon, walletTypeIcon } from '@/features/wallets/walletMeta'
import { generateId } from '@/shared/lib/generateId'
import { random } from '@/shared/lib/random'

const props = defineProps<{
  modelValue: boolean
  walletId: string | null
}>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const { t } = useI18n()
const walletsStore = useWalletsStore()
const userStore = useUserStore()

const isEdit = computed(() => !!props.walletId)
const confirmDelete = ref(false)
const iconPicker = ref(false)

// Renk seçici için sadeleştirilmiş palet (colorsArray'den örnek).
const palette = colorsArray.filter((_, i) => i % 6 === 0)

const currencyItems = allCurrencies.map(c => ({ code: c.code, title: `${c.code} — ${c.name}` }))

interface FormState {
  name: string
  /** '' = seçilmedi → tür varsayılan ikonu gösterilir. */
  icon: string
  type: WalletType
  currency: string
  color: string
  desc: string
  creditLimit: number
  isWithdrawal: boolean
  isExcludeInTotal: boolean
  isArchived: boolean
  order: number
  /**
       Cüzdanın alanı DEĞİL: user_settings'teki tek işaretçinin bu cüzdanı
      gösterip göstermediği. Kaydetmede ayrı yazılır.
   */
  isDefault: boolean
}

function blankForm(): FormState {
  return {
    name: '',
    icon: '',
    type: 'cash',
    currency: 'USD',
    color: random(colorsArray),
    desc: '',
    creditLimit: 0,
    isWithdrawal: false,
    isExcludeInTotal: false,
    isArchived: false,
    order: 0,
    isDefault: false,
  }
}

const form = reactive<FormState>(blankForm())

const typeItems = computed(() =>
  walletTypes.map(type => ({ value: type, title: t(`wallets.types.${type}`), icon: walletTypeIcon[type] })),
)

/**
     Başlık şeridinin ikinci satırı: "Cüzdan ekle" tek başına neyi eklediğini
    söylemiyor; tür seçildikçe şerit onu yansıtır.
 */
const typeLabel = computed(() => t(`wallets.types.${form.type}`))

function loadForm() {
  if (props.walletId && walletsStore.items?.[props.walletId]) {
    const w = walletsStore.items[props.walletId]!
    Object.assign(form, {
      name: w.name,
      icon: w.icon,
      type: w.type,
      currency: w.currency,
      color: w.color,
      desc: w.desc,
      creditLimit: w.type === 'credit' ? w.creditLimit : 0,
      isWithdrawal: w.isWithdrawal,
      isExcludeInTotal: w.isExcludeInTotal,
      isArchived: w.isArchived,
      order: w.order,
      isDefault: userStore.defaultWalletId === props.walletId,
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

/**
 * Şu an BAŞKA bir cüzdan varsayılansa onun adı. İşaretçi tek olduğu için bu
 * anahtarı açmak varsayılanı ondan alır — kullanıcı bunu önceden görmeli.
 */
const otherDefaultName = computed(() => {
  const current = userStore.defaultWalletId
  if (!current || current === props.walletId)
    return null
  return walletsStore.items?.[current]?.name ?? null
})

function close() {
  emit('update:modelValue', false)
}

function save() {
  const base = {
    name: form.name.trim(),
    icon: form.icon,
    currency: form.currency.trim().toUpperCase(),
    color: form.color,
    desc: form.desc,
    isWithdrawal: form.isWithdrawal,
    isExcludeInTotal: form.isExcludeInTotal,
    isArchived: form.isArchived,
    order: form.order,
    updatedAt: Date.now(),
  }
  const values = form.type === 'credit'
    ? { ...base, type: 'credit' as const, creditLimit: Number(form.creditLimit) || 0 }
    : { ...base, type: form.type }

  const parsed = walletItemSchema.safeParse(values)
  if (!parsed.success)
    return

  const id = props.walletId ?? generateId()
  walletsStore.saveWallet({ id, values: parsed.data as WalletItem })

  // Varsayılan işaretçisi cüzdan satırında değil user_settings'te durur →
  // ayrı yazılır ve YALNIZ değiştiyse. Yeni cüzdanda id burada oluşuyor.
  // Kapatırken null yazmak, başka bir cüzdan varsayılansa onu da silerdi;
  // bu yüzden önce bu cüzdanın gerçekten varsayılan olup olmadığına bakılır.
  const wasDefault = userStore.defaultWalletId === id
  if (form.isDefault !== wasDefault)
    userStore.saveDefaultWalletId(form.isDefault ? id : null)

  close()
}

function remove() {
  if (!props.walletId)
    return
  walletsStore.deleteWallet(props.walletId)
  close()
}
</script>

<template>
  <FormDrawer
    :model-value="modelValue"
    :title="isEdit ? t('wallets.edit') : t('wallets.add')"
    :subtitle="typeLabel"
    :icon="walletIcon(form)"
    :deletable="isEdit"
    :save-disabled="!isValid"
    @update:model-value="emit('update:modelValue', $event)"
    @save="save"
    @delete="confirmDelete = true"
  >
    <!-- Alanlar arası boşluk FormDrawer'ın gövdesinden (gap) geliyor; burada
         mb-* YOK. İlişkili öğeler tek bir çocuk içinde gruplanır ki aralarındaki
         mesafe gruplar arası mesafeden küçük kalsın (Material: yakınlık ilkesi). -->

    <!-- İkon seçilmediyse tür varsayılanı gösterilir; kullanıcı seçince o sabitlenir. -->
    <div class="d-flex align-center ga-3">
      <v-avatar :color="form.color" size="56" class="cursor-pointer" @click="iconPicker = true">
        <v-icon :icon="walletIcon(form)" color="white" size="28" />
      </v-avatar>
      <v-btn variant="tonal" size="small" @click="iconPicker = true">
        {{ t('wallets.pickIcon') }}
      </v-btn>
      <v-btn
        v-if="form.icon"
        variant="text"
        size="small"
        :aria-label="t('wallets.resetIcon')"
        @click="form.icon = ''"
      >
        {{ t('wallets.resetIcon') }}
      </v-btn>
    </div>

    <v-text-field
      v-model="form.name"
      :label="t('wallets.name')"
      :rules="['required']"
      autofocus
    />

    <v-select v-model="form.type" :items="typeItems" :label="t('wallets.type')">
      <template #selection="{ item }">
        <v-icon :icon="walletTypeIcon[form.type]" size="20" class="me-2" />
        {{ item.title }}
      </template>
      <!-- İkonu slot item şeklinden değil, kendi haritamızdan türet (sürümden bağımsız). -->
      <template #item="{ props: itemProps }">
        <v-list-item v-bind="itemProps" :prepend-icon="walletTypeIcon[itemProps.value as WalletType]" />
      </template>
    </v-select>

    <v-autocomplete
      v-model="form.currency"
      :items="currencyItems"
      item-title="title"
      item-value="code"
      :label="t('wallets.currency')"
      :rules="['required']"
    />

    <v-text-field
      v-if="form.type === 'credit'"
      v-model.number="form.creditLimit"
      type="number"
      :label="t('wallets.creditLimit')"
    />

    <!-- Etiket + örnekler tek grup: başlık kendi alanına yapışık kalmalı. -->
    <div>
      <div class="text-body-2 text-medium-emphasis mb-2">
        {{ t('wallets.color') }}
      </div>
      <ColorSwatches v-model="form.color" :colors="palette" />
    </div>

    <v-textarea v-model="form.desc" :label="t('wallets.description')" rows="2" auto-grow />

    <!-- Anahtarlar tek grup, kendi aralarında daha dar boşlukla: hepsi aynı
         soruyu (cüzdanın davranışı) yanıtlıyor. hide-details oldukları için
         eskiden ARALARINDA HİÇ boşluk yoktu — görseldeki sıkışıklık buydu. -->
    <div class="d-flex flex-column ga-2">
      <div>
        <v-switch v-model="form.isDefault" :label="t('wallets.default')" />
        <div v-if="form.isDefault && otherDefaultName" class="text-caption text-medium-emphasis ms-1">
          {{ t('wallets.defaultMovedFrom', { name: otherDefaultName }) }}
        </div>
      </div>
      <v-switch v-model="form.isWithdrawal" :label="t('wallets.withdrawal')" />
      <v-switch v-model="form.isExcludeInTotal" :label="t('wallets.excludeInTotal')" />
      <v-switch v-model="form.isArchived" :label="t('wallets.archived')" />
    </div>
  </FormDrawer>

  <IconPicker v-model="iconPicker" v-model:icon="form.icon" :title="t('wallets.pickIcon')" />

  <ConfirmDialog
    v-model="confirmDelete"
    :title="t('wallets.edit')"
    :message="t('wallets.deleteConfirm')"
    @confirm="remove"
  />
</template>
