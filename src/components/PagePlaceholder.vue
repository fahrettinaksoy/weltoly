<script setup lang="ts">
defineProps<{
  title: string
  icon: string
}>()
</script>

<template>
  <div class="pa-4">
    <div class="d-flex align-center mb-6">
      <v-icon :icon="icon" size="28" class="me-3" color="primary" />
      <h1 class="text-h5 font-weight-bold">{{ title }}</h1>
    </div>

    <v-card variant="tonal" class="pa-8 text-center">
      <v-icon :icon="icon" size="56" class="mb-4 text-medium-emphasis" />
      <div class="text-body-1 text-medium-emphasis">
        {{ $t('common.soon') }}
      </div>
    </v-card>
  </div>
</template>
