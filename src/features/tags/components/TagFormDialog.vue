<script setup lang="ts">
import type { TagId } from '@/features/tags/types'

import { useI18n } from 'vue-i18n'
import ColorSwatches from '@/components/ColorSwatches.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import FormDrawer from '@/components/FormDrawer.vue'
import { colorsArray } from '@/features/color/colors'
import { useTagsStore } from '@/features/tags/store'
import { generateId } from '@/shared/lib/generateId'
import { random } from '@/shared/lib/random'

const props = defineProps<{ tagId: TagId | null }>()
const emit = defineEmits<{
  (e: 'created', id: TagId): void
}>()

const model = defineModel<boolean>({ required: true })

const { t } = useI18n()
const tagsStore = useTagsStore()

// Renk paleti — kategori formuyla aynı seyreltme (her 6. renk).
const palette = colorsArray.filter((_, i) => i % 6 === 0)

const form = reactive<{ name: string; color: string; desc: string }>({
  name: '',
  color: random(colorsArray),
  desc: ''
})

const isEdit = computed(() => !!props.tagId)
const isValid = computed(() => form.name.trim().length > 0)
const confirmDelete = ref(false)

// Dialog açıldığında formu doldur (düzenleme) ya da sıfırla (oluşturma).
watch(model, (open) => {
  if (!open) return
  const existing = props.tagId ? tagsStore.items[props.tagId] : null
  form.name = existing?.name ?? ''
  form.color = existing?.color ?? random(colorsArray)
  form.desc = existing?.desc ?? ''
  confirmDelete.value = false
})

function save() {
  if (!isValid.value) return
  const id = props.tagId ?? generateId()
  tagsStore.saveTag({ id, values: { name: form.name, color: form.color, desc: form.desc.trim() } })
  if (!props.tagId) emit('created', id)
  model.value = false
}

function remove() {
  if (props.tagId) tagsStore.deleteTag(props.tagId)
  model.value = false
}
</script>

<template>
  <FormDrawer
    v-model="model"
    :title="isEdit ? t('tags.editTitle') : t('tags.newTitle')"
    :subtitle="form.name.trim() || undefined"
    icon="mdi-tag"
    :deletable="isEdit"
    :save-disabled="!isValid"
    @save="save"
    @delete="confirmDelete = true"
  >
    <!-- Alanlar arası boşluk FormDrawer gövdesinden (gap); burada mb-* YOK. -->
    <div class="d-flex align-center ga-3">
      <v-avatar :color="form.color" size="56" class="flex-0-0">
        <v-icon icon="mdi-tag" color="white" size="28" />
      </v-avatar>
      <!-- hide-details="auto" ŞART: düz hide-details doğrulama mesajını da gizler. -->
      <v-text-field
        v-model="form.name"
        :label="t('tags.name')"
        :rules="['required']"
        autofocus
        hide-details="auto"
        @keyup.enter="save"
      />
    </div>

    <v-textarea v-model="form.desc" :label="t('tags.description')" rows="2" auto-grow />

    <!-- Etiket + örnekler tek grup: başlık kendi alanına yapışık kalmalı. -->
    <div>
      <div class="text-body-2 text-medium-emphasis mb-2">
        {{ t('tags.color') }}
      </div>
      <ColorSwatches v-model="form.color" :colors="palette" />
    </div>
  </FormDrawer>

  <ConfirmDialog
    v-model="confirmDelete"
    :title="t('tags.editTitle')"
    :message="t('tags.deleteConfirm')"
    @confirm="remove"
  />
</template>
