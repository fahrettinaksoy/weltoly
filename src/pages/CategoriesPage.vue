<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { useCategoriesStore } from '@/features/categories/store'
import CategoryFormDialog from '@/features/categories/components/CategoryFormDialog.vue'
import { useAppBarAction } from '@/composables/useAppBarAction'

const { t } = useI18n()
const categoriesStore = useCategoriesStore()

const showDialog = ref(false)
const editId = ref<string | null>(null)

function openNew() {
  editId.value = null
  showDialog.value = true
}
useAppBarAction({ icon: '$add', onClick: openNew })

function openEdit(id: string) {
  editId.value = id
  showDialog.value = true
}
</script>

<template>
  <div class="pa-4">
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
            <v-icon icon="mdi-star" color="warning" size="18" />
          </template>
        </v-list-item>

        <!-- Alt kategoriler: hiyerarşiyi gösteren ağaç çizgileriyle (tree lines) -->
        <div v-if="categoriesStore.getChildrenIds(rootId).length" class="cat-tree">
          <v-list-item
            v-for="(childId, i) in categoriesStore.getChildrenIds(rootId)"
            :key="childId"
            rounded="lg"
            class="cat-tree__item"
            :class="{ 'cat-tree__item--last': i === categoriesStore.getChildrenIds(rootId).length - 1 }"
            @click="openEdit(childId)"
          >
            <template #prepend>
              <v-avatar :color="categoriesStore.items[childId]?.color" size="30">
                <v-icon :icon="categoriesStore.items[childId]?.icon" color="white" size="16" />
              </v-avatar>
            </template>
            <v-list-item-title>{{ categoriesStore.items[childId]?.name }}</v-list-item-title>
            <template v-if="categoriesStore.items[childId]?.showInQuickSelector" #append>
              <v-icon icon="mdi-star" color="warning" size="16" />
            </template>
          </v-list-item>
        </div>
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

<style scoped>
/* Kategori hiyerarşisi ağaç çizgileri (tree lines). Dikey gövde + her alt öğeye dirsek. */
.cat-tree {
  position: relative;
}

.cat-tree__item {
  position: relative;
  padding-inline-start: 52px !important;
}

/* Dikey gövde çizgisi (öğeler arasında sürekli olsun diye tam yükseklik). */
.cat-tree__item::before {
  content: '';
  position: absolute;
  inset-inline-start: 26px;
  top: 0;
  height: 100%;
  width: 2px;
  background: rgba(var(--v-border-color), 0.28);
}

/* Son alt öğede gövde çizgisini dirseğe kadar (ortaya) kes. */
.cat-tree__item--last::before {
  height: 50%;
}

/* Yatay dirsek çizgisi. */
.cat-tree__item::after {
  content: '';
  position: absolute;
  inset-inline-start: 26px;
  top: 50%;
  width: 16px;
  height: 2px;
  background: rgba(var(--v-border-color), 0.28);
}

/* RTL'de dirsek ve gövde otomatik yansısın diye inset-inline-start kullanıldı. */
</style>
