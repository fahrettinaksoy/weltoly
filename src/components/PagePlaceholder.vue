<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import AppEmptyState from '@/components/AppEmptyState.vue'

defineProps<{
  title: string
  icon: string
}>()

const { t } = useI18n()
</script>

<template>
  <div class="pa-4">
    <div class="d-flex align-center mb-6">
      <v-icon :icon="icon" size="28" class="me-3" color="primary" />
      <h1 class="text-h5 font-weight-bold">{{ title }}</h1>
    </div>

    <AppEmptyState :icon="icon" :title="title" :text="t('common.soon')" />
  </div>
</template>
