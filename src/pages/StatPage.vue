<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <PagePlaceholder :title="t('nav.stat')" icon="mdi-chart-box-outline" />
</template>
