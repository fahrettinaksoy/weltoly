<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { generateId } from '@/shared/lib/generateId'
import { random } from '@/shared/lib/random'
import { colorsArray } from '@/features/color/colors'
import { useCategoriesStore } from '@/features/categories/store'
import FormDrawer from '@/components/FormDrawer.vue'
import ColorSwatches from '@/components/ColorSwatches.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import IconPicker from '@/components/IconPicker.vue'
import { categoryIcons } from '@/features/categories/iconList'
import type { CategoryId } from '@/features/categories/types'

const props = defineProps<{ modelValue: boolean, categoryId: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const { t } = useI18n()
const categoriesStore = useCategoriesStore()

const isEdit = computed(() => !!props.categoryId)
const confirmDelete = ref(false)
const iconPicker = ref(false)

const palette = colorsArray.filter((_, i) => i % 6 === 0)

type FormState = {
  name: string
  desc: string
  icon: string
  color: string
  parentId: CategoryId | 0
  showInLastUsed: boolean
  showInQuickSelector: boolean
}

function blankForm(): FormState {
  return {
    name: '', desc: '', icon: random(categoryIcons), color: random(colorsArray),
    parentId: 0, showInLastUsed: true, showInQuickSelector: false,
  }
}

const form = reactive<FormState>(blankForm())

// Üst kategori olabilecekler: kök kategoriler (kendisi ve çocukları hariç).
/** Başlık şeridinin ikinci satırı: kök mü, yoksa hangi kategorinin altında. */
const parentLabel = computed(() =>
  form.parentId
    ? categoriesStore.items[form.parentId]?.name ?? t('categories.noParent')
    : t('categories.noParent'),
)

const parentOptions = computed(() => {
  const selfId = props.categoryId
  const childIds = selfId ? categoriesStore.getChildrenIds(selfId) : []
  const excluded = new Set([selfId, ...childIds])
  const opts = categoriesStore.categoriesRootIds
    .filter(id => !excluded.has(id))
    .map(id => ({ value: id as CategoryId | 0, title: categoriesStore.items[id]?.name ?? id }))
  return [{ value: 0 as CategoryId | 0, title: t('categories.noParent') }, ...opts]
})

function loadForm() {
  if (props.categoryId && categoriesStore.items[props.categoryId]) {
    const c = categoriesStore.items[props.categoryId]!
    Object.assign(form, {
      name: c.name, desc: c.desc, icon: c.icon, color: c.color, parentId: c.parentId,
      showInLastUsed: c.showInLastUsed, showInQuickSelector: c.showInQuickSelector,
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

const isValid = computed(() => form.name.trim().length > 0 && form.icon.trim().length > 0)

function close() {
  emit('update:modelValue', false)
}

function save() {
  if (!isValid.value)
    return
  const id = props.categoryId ?? generateId()
  categoriesStore.saveCategory({
    id,
    isUpdateChildCategoriesColor: false,
    values: {
      name: form.name.trim(), desc: form.desc.trim(), icon: form.icon, color: form.color, parentId: form.parentId,
      showInLastUsed: form.showInLastUsed, showInQuickSelector: form.showInQuickSelector,
    },
  })
  close()
}


function remove() {
  if (!props.categoryId)
    return
  categoriesStore.deleteCategory(props.categoryId)
  close()
}
</script>

<template>
  <FormDrawer
    :model-value="modelValue"
    :title="isEdit ? t('categories.edit') : t('categories.add')"
    :subtitle="parentLabel"
    :icon="form.icon"
    :deletable="isEdit"
    :save-disabled="!isValid"
    :width="480"
    @update:model-value="emit('update:modelValue', $event)"
    @save="save"
    @delete="confirmDelete = true"
  >
    <!-- Alanlar arası boşluk FormDrawer gövdesinden (gap); burada mb-* YOK. -->
    <div class="d-flex align-center ga-3">
      <v-avatar :color="form.color" size="56" class="cursor-pointer" @click="iconPicker = true">
        <v-icon :icon="form.icon" color="white" size="28" />
      </v-avatar>
      <v-btn variant="tonal" size="small" @click="iconPicker = true">{{ t('categories.pickIcon') }}</v-btn>
    </div>

    <v-text-field
      v-model="form.name"
      :label="t('categories.name')"
      :rules="['required']"
      autofocus
    />

    <v-select v-model="form.parentId" :items="parentOptions" :label="t('categories.parent')" />

    <v-textarea v-model="form.desc" :label="t('categories.description')" rows="2" auto-grow />

    <!-- Etiket + örnekler tek grup: başlık kendi alanına yapışık kalmalı. -->
    <div>
      <div class="text-body-medium text-medium-emphasis mb-2">{{ t('categories.color') }}</div>
      <ColorSwatches v-model="form.color" :colors="palette" />
    </div>

    <!-- Anahtarlar tek grup: ikisi de "nerede görünsün" sorusunu yanıtlıyor. -->
    <div class="d-flex flex-column ga-2">
      <v-switch v-model="form.showInLastUsed" :label="t('categories.showInLastUsed')" />
      <v-switch v-model="form.showInQuickSelector" :label="t('categories.showInQuickSelector')" />
    </div>
  </FormDrawer>

  <!-- İkon seçici -->
  <IconPicker v-model="iconPicker" v-model:icon="form.icon" :title="t('categories.pickIcon')" />

    <!-- Silme onayı -->
    <ConfirmDialog
      v-model="confirmDelete"
      :title="t('categories.edit')"
      :message="t('categories.deleteConfirm')"
      @confirm="remove"
    />
</template>

<style scoped>
.cursor-pointer { cursor: pointer; }
</style>
