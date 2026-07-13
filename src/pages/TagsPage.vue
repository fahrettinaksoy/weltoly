<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { useTagsStore } from '@/features/tags/store'
import TagFormDialog from '@/features/tags/components/TagFormDialog.vue'
import type { TagId } from '@/features/tags/types'

const { t } = useI18n()
const tagsStore = useTagsStore()

const showDialog = ref(false)
const editId = ref<TagId | null>(null)

function openNew() {
  editId.value = null
  showDialog.value = true
}
function openEdit(id: TagId) {
  editId.value = id
  showDialog.value = true
}
</script>

<template>
  <div class="pa-4">
    <div class="d-flex align-center mb-4">
      <v-icon icon="$navTags" size="28" class="me-3" color="primary" />
      <h1 class="text-h5 font-weight-bold">{{ t('tags.title') }}</h1>
      <v-spacer />
      <v-btn icon="mdi-plus" color="primary" variant="flat" size="small" @click="openNew" />
    </div>

    <div v-if="tagsStore.hasItems" class="d-flex flex-wrap ga-2">
      <v-chip
        v-for="id in tagsStore.sortedIds"
        :key="id"
        :color="tagsStore.items[id]?.color"
        variant="flat"
        prepend-icon="mdi-tag"
        @click="openEdit(id)"
      >
        {{ tagsStore.items[id]?.name }}
      </v-chip>
    </div>

    <v-card v-else variant="tonal" class="pa-8 text-center">
      <v-icon icon="mdi-tag-multiple-outline" size="56" class="mb-4 text-medium-emphasis" />
      <div class="text-body-1 mb-1">{{ t('tags.empty') }}</div>
      <div class="text-body-2 text-medium-emphasis mb-4">{{ t('tags.emptyHint') }}</div>
      <v-btn-primary prepend-icon="mdi-plus" @click="openNew">{{ t('tags.add') }}</v-btn-primary>
    </v-card>

    <TagFormDialog v-model="showDialog" :tag-id="editId" />
  </div>
</template>
