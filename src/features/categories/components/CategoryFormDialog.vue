<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { generateId } from '@/shared/lib/generateId'
import { random } from '@/shared/lib/random'
import { colorsArray } from '@/features/color/colors'
import { categoryIcons } from '@/features/categories/iconList'
import { useCategoriesStore } from '@/features/categories/store'
import { useTrnsStore } from '@/features/trns/store'
import type { CategoryId } from '@/features/categories/types'

const props = defineProps<{ modelValue: boolean, categoryId: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const { t } = useI18n()
const categoriesStore = useCategoriesStore()
const trnsStore = useTrnsStore()

const isEdit = computed(() => !!props.categoryId)
const confirmDelete = ref(false)
const iconPicker = ref(false)
const iconSearch = ref('')

const palette = colorsArray.filter((_, i) => i % 6 === 0)

type FormState = {
  name: string
  icon: string
  color: string
  parentId: CategoryId | 0
  showInLastUsed: boolean
  showInQuickSelector: boolean
}

function blankForm(): FormState {
  return {
    name: '', icon: random(categoryIcons), color: random(colorsArray),
    parentId: 0, showInLastUsed: true, showInQuickSelector: false,
  }
}

const form = reactive<FormState>(blankForm())

// Üst kategori olabilecekler: kök kategoriler (kendisi ve çocukları hariç).
const parentOptions = computed(() => {
  const selfId = props.categoryId
  const childIds = selfId ? categoriesStore.getChildrenIds(selfId) : []
  const excluded = new Set([selfId, ...childIds])
  const opts = categoriesStore.categoriesRootIds
    .filter(id => !excluded.has(id))
    .map(id => ({ value: id as CategoryId | 0, title: categoriesStore.items[id]?.name ?? id }))
  return [{ value: 0 as CategoryId | 0, title: t('categories.noParent') }, ...opts]
})

const filteredIcons = computed(() => {
  const q = iconSearch.value.trim().toLowerCase()
  const list = q ? categoryIcons.filter(i => i.toLowerCase().includes(q)) : categoryIcons
  return list.slice(0, 300)
})

function loadForm() {
  if (props.categoryId && categoriesStore.items[props.categoryId]) {
    const c = categoriesStore.items[props.categoryId]!
    Object.assign(form, {
      name: c.name, icon: c.icon, color: c.color, parentId: c.parentId,
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
      name: form.name.trim(), icon: form.icon, color: form.color, parentId: form.parentId,
      showInLastUsed: form.showInLastUsed, showInQuickSelector: form.showInQuickSelector,
    },
  })
  close()
}

function referencingTrnIds(categoryId: string): string[] {
  const trns = trnsStore.items
  if (!trns)
    return []
  const ids: string[] = []
  for (const id in trns) {
    if (trns[id]!.categoryId === categoryId)
      ids.push(id)
  }
  return ids
}

function remove() {
  if (!props.categoryId)
    return
  categoriesStore.deleteCategory(props.categoryId, referencingTrnIds(props.categoryId))
  confirmDelete.value = false
  close()
}
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="480" scrollable @update:model-value="emit('update:modelValue', $event)">
    <v-card>
      <v-card-title class="d-flex align-center">
        {{ isEdit ? t('categories.edit') : t('categories.add') }}
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" size="small" @click="close" />
      </v-card-title>

      <v-card-text>
        <div class="d-flex align-center ga-3 mb-4">
          <v-avatar :color="form.color" size="56" class="cursor-pointer" @click="iconPicker = true">
            <v-icon :icon="form.icon" color="white" size="28" />
          </v-avatar>
          <v-btn variant="tonal" size="small" @click="iconPicker = true">{{ t('categories.pickIcon') }}</v-btn>
        </div>

        <v-text-field v-model="form.name" :label="t('categories.name')" autofocus class="mb-2" />

        <v-select
          v-model="form.parentId"
          :items="parentOptions"
          :label="t('categories.parent')"
          class="mb-2"
        />

        <div class="text-body-2 text-medium-emphasis mb-1">{{ t('categories.color') }}</div>
        <div class="d-flex flex-wrap ga-2 mb-3">
          <button
            v-for="c in palette" :key="c" type="button" class="color-dot"
            :style="{ background: c, outline: form.color === c ? '2px solid white' : 'none' }"
            @click="form.color = c"
          />
        </div>

        <v-switch v-model="form.showInLastUsed" :label="t('categories.showInLastUsed')" color="primary" density="compact" hide-details />
        <v-switch v-model="form.showInQuickSelector" :label="t('categories.showInQuickSelector')" color="primary" density="compact" hide-details />
      </v-card-text>

      <v-card-actions>
        <v-btn v-if="isEdit" color="error" variant="text" @click="confirmDelete = true">{{ t('common.delete') }}</v-btn>
        <v-spacer />
        <v-btn variant="text" @click="close">{{ t('common.cancel') }}</v-btn>
        <v-btn color="primary" variant="flat" :disabled="!isValid" @click="save">{{ t('common.save') }}</v-btn>
      </v-card-actions>
    </v-card>

    <!-- İkon seçici -->
    <v-dialog v-model="iconPicker" max-width="520" scrollable>
      <v-card>
        <v-card-title class="d-flex align-center">
          {{ t('categories.pickIcon') }}
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" size="small" @click="iconPicker = false" />
        </v-card-title>
        <v-card-text style="max-height: 60vh;">
          <v-text-field v-model="iconSearch" prepend-inner-icon="mdi-magnify" density="compact" hide-details class="mb-3" clearable />
          <div class="icon-grid">
            <v-btn
              v-for="ic in filteredIcons" :key="ic" :icon="ic" variant="text" size="small"
              :color="form.icon === ic ? 'primary' : undefined"
              @click="form.icon = ic; iconPicker = false"
            />
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- Silme onayı -->
    <v-dialog v-model="confirmDelete" max-width="360">
      <v-card>
        <v-card-text>{{ t('categories.deleteConfirm') }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmDelete = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="error" variant="flat" @click="remove">{{ t('common.delete') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-dialog>
</template>

<style scoped>
.color-dot { width: 28px; height: 28px; border-radius: 50%; outline-offset: 2px; cursor: pointer; }
.cursor-pointer { cursor: pointer; }
.icon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)); gap: 4px; }
</style>
