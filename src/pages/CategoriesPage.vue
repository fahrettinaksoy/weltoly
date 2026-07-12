<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { useCategoriesStore } from '@/features/categories/store'
import CategoryFormDialog from '@/features/categories/components/CategoryFormDialog.vue'

const { t } = useI18n()
const categoriesStore = useCategoriesStore()

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
</script>

<template>
  <div class="pa-4">
    <div class="d-flex align-center mb-4">
      <v-icon icon="mdi-shape-outline" size="28" class="me-3" color="primary" />
      <h1 class="text-h5 font-weight-bold">{{ t('categories.title') }}</h1>
      <v-spacer />
      <v-btn icon="mdi-plus" color="primary" variant="flat" size="small" @click="openNew" />
    </div>

    <v-list v-if="categoriesStore.hasItems" class="bg-transparent">
      <template v-for="rootId in categoriesStore.categoriesRootIds" :key="rootId">
        <v-list-item rounded="lg" class="mb-1" @click="openEdit(rootId)">
          <template #prepend>
            <v-avatar :color="categoriesStore.items[rootId]?.color" size="36">
              <v-icon :icon="categoriesStore.items[rootId]?.icon" color="white" size="20" />
            </v-avatar>
          </template>
          <v-list-item-title class="font-weight-medium">{{ categoriesStore.items[rootId]?.name }}</v-list-item-title>
          <template v-if="categoriesStore.items[rootId]?.showInQuickSelector" #append>
            <v-icon icon="mdi-star" color="amber" size="18" />
          </template>
        </v-list-item>

        <!-- Alt kategoriler -->
        <v-list-item
          v-for="childId in categoriesStore.getChildrenIds(rootId)"
          :key="childId"
          rounded="lg"
          class="mb-1 ms-8"
          @click="openEdit(childId)"
        >
          <template #prepend>
            <v-avatar :color="categoriesStore.items[childId]?.color" size="30">
              <v-icon :icon="categoriesStore.items[childId]?.icon" color="white" size="16" />
            </v-avatar>
          </template>
          <v-list-item-title>{{ categoriesStore.items[childId]?.name }}</v-list-item-title>
        </v-list-item>
      </template>
    </v-list>

    <v-card v-else variant="tonal" class="pa-8 text-center">
      <v-icon icon="mdi-shape-plus-outline" size="56" class="mb-4 text-medium-emphasis" />
      <div class="text-body-1 mb-1">{{ t('categories.empty') }}</div>
      <div class="text-body-2 text-medium-emphasis mb-4">{{ t('categories.emptyHint') }}</div>
      <v-btn-primary prepend-icon="mdi-plus" @click="openNew">{{ t('categories.add') }}</v-btn-primary>
    </v-card>

    <CategoryFormDialog v-model="showDialog" :category-id="editId" />
  </div>
</template>
