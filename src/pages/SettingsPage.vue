<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { useSettingsStore, type ThemeMode } from '@/stores/settings'
import type { LocaleCode } from '@/i18n/messages'

const { t } = useI18n()
const settings = useSettingsStore()

const themeOptions = computed<{ value: ThemeMode, label: string, icon: string }[]>(() => [
  { value: 'system', label: t('settings.themeSystem'), icon: 'mdi-theme-light-dark' },
  { value: 'light', label: t('settings.themeLight'), icon: 'mdi-white-balance-sunny' },
  { value: 'dark', label: t('settings.themeDark'), icon: 'mdi-weather-night' },
])

const localeOptions: { value: LocaleCode, label: string }[] = [
  { value: 'tr', label: 'Türkçe' },
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
]
</script>

<template>
  <div class="pa-4">
    <div class="d-flex align-center mb-6">
      <v-icon icon="mdi-cog-outline" size="28" class="me-3" color="primary" />
      <h1 class="text-h5 font-weight-bold">{{ t('settings.title') }}</h1>
    </div>

    <v-card variant="tonal" class="mb-4">
      <v-card-title class="text-subtitle-1">{{ t('settings.appearance') }}</v-card-title>
      <v-card-text>
        <div class="text-body-2 text-medium-emphasis mb-2">{{ t('settings.theme') }}</div>
        <v-btn-toggle
          :model-value="settings.themeMode"
          color="primary"
          density="comfortable"
          rounded="lg"
          mandatory
          divided
          @update:model-value="settings.setThemeMode($event as ThemeMode)"
        >
          <v-btn v-for="opt in themeOptions" :key="opt.value" :value="opt.value" :prepend-icon="opt.icon">
            {{ opt.label }}
          </v-btn>
        </v-btn-toggle>
      </v-card-text>
    </v-card>

    <v-card variant="tonal">
      <v-card-title class="text-subtitle-1">{{ t('settings.language') }}</v-card-title>
      <v-card-text>
        <v-select
          :model-value="settings.locale"
          :items="localeOptions"
          item-title="label"
          item-value="value"
          hide-details
          @update:model-value="settings.setAppLocale($event as LocaleCode)"
        />
      </v-card-text>
    </v-card>

    <div class="text-caption text-medium-emphasis mt-6 text-center">
      Weltoly · v0.1.0 · Faz 0 (iskelet)
    </div>
  </div>
</template>
