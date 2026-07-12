<script setup lang="ts">
import { useTheme } from 'vuetify'
import { useDocumentVisibility, usePreferredDark } from '@vueuse/core'

import DefaultLayout from '@/layouts/DefaultLayout.vue'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'
import { neutralPalettes } from '@/features/theme/palette'
import { useLockStore } from '@/features/auth/useLockStore'
import LockScreen from '@/features/auth/LockScreen.vue'
import { useInitApp } from '@/composables/useInitApp'
import { setLocale } from '@/plugins/i18n'

const theme = useTheme()
const settings = useSettingsStore()
const ui = useUiStore()
const lock = useLockStore()
const prefersDark = usePreferredDark()
const { init } = useInitApp()

// Uygulama arka plana alınınca PIN varsa kilitle.
const visibility = useDocumentVisibility()
watch(visibility, (v) => {
  if (v === 'hidden')
    lock.lock()
})

// Etkin tema: 'system' ise OS tercihine göre, aksi halde seçilen mod.
const effectiveTheme = computed(() =>
  settings.themeMode === 'system'
    ? (prefersDark.value ? 'dark' : 'light')
    : settings.themeMode,
)

watchEffect(() => {
  theme.global.name.value = effectiveTheme.value
})

// Ana rengi her iki temaya dinamik uygula.
watchEffect(() => {
  const c = settings.primaryColor
  const themes = theme.themes.value
  if (themes.light?.colors)
    themes.light.colors.primary = c
  if (themes.dark?.colors)
    themes.dark.colors.primary = c
})

// Nötr palet (arka plan/yüzey tonları) — her iki temaya uygula.
watchEffect(() => {
  const p = neutralPalettes[settings.neutral]
  const themes = theme.themes.value
  if (p && themes.light?.colors) {
    themes.light.colors.background = p.light.background
    themes.light.colors.surface = p.light.surface
    themes.light.colors['surface-variant'] = p.light.variant
  }
  if (p && themes.dark?.colors) {
    themes.dark.colors.background = p.dark.background
    themes.dark.colors.surface = p.dark.surface
    themes.dark.colors['surface-variant'] = p.dark.variant
  }
})

// Köşe yuvarlaklığı — CSS değişkeni (global app.css kartlara uygular).
watchEffect(() => {
  document.documentElement.style.setProperty('--app-radius', `${settings.radius}px`)
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

    <LockScreen v-if="lock.isLocked" />
  </v-app>
</template>
