<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <PagePlaceholder :title="t('nav.dashboard')" icon="mdi-view-dashboard-outline" />
</template>
