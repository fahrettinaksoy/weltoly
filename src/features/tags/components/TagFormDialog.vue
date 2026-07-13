<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { random } from '@/shared/lib/random'
import { generateId } from '@/shared/lib/generateId'
import { colorsArray } from '@/features/color/colors'
import { useTagsStore } from '@/features/tags/store'
import FormDrawer from '@/components/FormDrawer.vue'
import type { TagId } from '@/features/tags/types'

const props = defineProps<{ tagId: TagId | null }>()
const emit = defineEmits<{
  (e: 'created', id: TagId): void
}>()

const model = defineModel<boolean>({ required: true })

const { t } = useI18n()
const tagsStore = useTagsStore()

// Renk paleti — kategori formuyla aynı seyreltme (her 6. renk).
const palette = colorsArray.filter((_, i) => i % 6 === 0)

const form = reactive<{ name: string, color: string }>({ name: '', color: random(colorsArray) })

const isEdit = computed(() => !!props.tagId)
const isValid = computed(() => form.name.trim().length > 0)
const confirmDelete = ref(false)

// Dialog açıldığında formu doldur (düzenleme) ya da sıfırla (oluşturma).
watch(model, (open) => {
  if (!open)
    return
  const existing = props.tagId ? tagsStore.items[props.tagId] : null
  form.name = existing?.name ?? ''
  form.color = existing?.color ?? random(colorsArray)
  confirmDelete.value = false
})

function save() {
  if (!isValid.value)
    return
  const id = props.tagId ?? generateId()
  tagsStore.saveTag({ id, values: { name: form.name, color: form.color } })
  if (!props.tagId)
    emit('created', id)
  model.value = false
}

function remove() {
  if (props.tagId)
    tagsStore.deleteTag(props.tagId)
  confirmDelete.value = false
  model.value = false
}
</script>

<template>
  <FormDrawer
    v-model="model"
    :title="isEdit ? t('tags.editTitle') : t('tags.newTitle')"
    :deletable="isEdit"
    :save-disabled="!isValid"
    @save="save"
    @delete="confirmDelete = true"
  >
    <div class="d-flex align-center mb-4">
      <v-avatar :color="form.color" size="40" class="me-3">
        <v-icon icon="mdi-tag" color="white" size="20" />
      </v-avatar>
      <v-text-field v-model="form.name" :label="t('tags.name')" autofocus hide-details density="comfortable" @keyup.enter="save" />
    </div>

    <div class="text-body-2 text-medium-emphasis mb-2">{{ t('tags.color') }}</div>
    <div class="d-flex flex-wrap ga-2">
      <button
        v-for="c in palette" :key="c" type="button" class="color-dot"
        :style="{ background: c, outline: form.color === c ? '2px solid white' : 'none' }"
        @click="form.color = c"
      />
    </div>
  </FormDrawer>

  <v-dialog v-model="confirmDelete" max-width="360">
    <v-card>
      <v-card-text>{{ t('tags.deleteConfirm') }}</v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="confirmDelete = false">{{ t('common.cancel') }}</v-btn>
        <v-btn color="error" variant="flat" @click="remove">{{ t('common.delete') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.color-dot { width: 28px; height: 28px; border-radius: 50%; outline-offset: 2px; cursor: pointer; }
</style>
