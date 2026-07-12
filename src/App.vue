<script setup lang="ts">
import { useTheme } from 'vuetify'
import { usePreferredDark } from '@vueuse/core'

import DefaultLayout from '@/layouts/DefaultLayout.vue'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'
import { useInitApp } from '@/composables/useInitApp'
import { setLocale } from '@/plugins/i18n'

const theme = useTheme()
const settings = useSettingsStore()
const ui = useUiStore()
const prefersDark = usePreferredDark()
const { init } = useInitApp()

// Etkin tema: 'system' ise OS tercihine göre, aksi halde seçilen mod.
const effectiveTheme = computed(() =>
  settings.themeMode === 'system'
    ? (prefersDark.value ? 'dark' : 'light')
    : settings.themeMode,
)

watchEffect(() => {
  theme.global.name.value = effectiveTheme.value
})

onMounted(() => {
  setLocale(settings.locale)
  init() // yerel SQLite watch'larını başlat (Tauri runtime'ında)
})
</script>

<template>
  <v-app>
    <DefaultLayout>
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>
    </DefaultLayout>

    <v-snackbar
      v-model="ui.snackbar.show"
      :color="ui.snackbar.color"
      timeout="3000"
      location="bottom"
    >
      {{ ui.snackbar.message }}
    </v-snackbar>
  </v-app>
</template>
