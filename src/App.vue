<script setup lang="ts">
import { useTheme } from 'vuetify'
import { usePreferredDark } from '@vueuse/core'

import DefaultLayout from '@/layouts/DefaultLayout.vue'
import { useSettingsStore } from '@/stores/settings'
import { setLocale } from '@/plugins/i18n'

const theme = useTheme()
const settings = useSettingsStore()
const prefersDark = usePreferredDark()

// Etkin tema: 'system' ise OS tercihine göre, aksi halde seçilen mod.
const effectiveTheme = computed(() =>
  settings.themeMode === 'system'
    ? (prefersDark.value ? 'dark' : 'light')
    : settings.themeMode,
)

watchEffect(() => {
  theme.global.name.value = effectiveTheme.value
})

// Kayıtlı dili uygula (store zaten localStorage'dan okur; <html lang> ve i18n'i senkronla).
onMounted(() => {
  setLocale(settings.locale)
})
</script>

<template>
  <v-app>
    <DefaultLayout>
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>
    </DefaultLayout>
  </v-app>
</template>
