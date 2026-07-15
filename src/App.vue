<script setup lang="ts">
import { useTheme } from 'vuetify'
import { useI18n } from 'vue-i18n'
import { useDocumentVisibility, usePreferredDark } from '@vueuse/core'

import DefaultLayout from '@/layouts/DefaultLayout.vue'
import HotkeysHelp from '@/components/HotkeysHelp.vue'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'
import { neutralPalettes } from '@/features/theme/palette'
import { useLockStore } from '@/features/auth/useLockStore'
import LockScreen from '@/features/auth/LockScreen.vue'
import { useInitApp } from '@/composables/useInitApp'
import { useAppHotkeys } from '@/composables/useAppHotkeys'
import { setLocale } from '@/plugins/i18n'

const { t } = useI18n()
const theme = useTheme()
const settings = useSettingsStore()
const ui = useUiStore()
const lock = useLockStore()
const prefersDark = usePreferredDark()
const { init } = useInitApp()
const { showHelp } = useAppHotkeys()

// internationalization: RTL-hazır. Şu an tr/en/ru LTR; RTL locale eklenirse otomatik döner.
const RTL_LOCALES = new Set<string>([/* 'ar', 'he', 'fa' */])
const isRtl = computed(() => RTL_LOCALES.has(settings.locale))

// Uygulama arka plana alınınca PIN varsa kilitle.
const visibility = useDocumentVisibility()
watch(visibility, (v) => {
  if (v === 'hidden')
    lock.lock()
})

// theme feature — etkin tema (system/light/dark).
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

// Nötr palet (arka plan/yüzey tonları).
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

// Köşe yuvarlaklığı (radius) — CSS değişkeni.
watchEffect(() => {
  document.documentElement.style.setProperty('--app-radius', `${settings.radius}px`)
})

onMounted(() => {
  setLocale(settings.locale)
  init()
})
</script>

<template>
  <v-app>
    <!-- Accessibility: içeriğe atla bağlantısı -->
    <a href="#main-content" class="skip-link">{{ t('a11y.skipToContent') }}</a>

    <!-- locale-provider: alt ağaç için locale + RTL (uygulama RTL-hazır) -->
    <v-locale-provider :locale="settings.locale" :rtl="isRtl">
      <DefaultLayout>
        <router-view v-slot="{ Component }">
          <component :is="Component" />
        </router-view>
      </DefaultLayout>
    </v-locale-provider>

    <!-- Merkezî bildirim kuyruğu: projedeki TÜM snackbar'lar buradan geçer.
         Kuyruk kendini tüketir (gösterileni modelden çıkarır) — stores/ui.ts ekler.
         Biçim (ikon, zamanlayıcı, renk) mesajın kendisinde; burada yalnız
         tüm kuyruk için ortak davranış durur. -->
    <v-snackbar-queue
      v-model="ui.snackbarQueue"
      :timeout="4000"
      :total-visible="3"
      location="bottom right"
      elevation="6"
      class="app-snackbar"
    >
      <!-- Kapatma: "Kapat" yazısı yerine ✕ ikonu.
           `closable` prop'u yerine actions slot'u kullanılıyor — slot varsa
           Vuetify eylem alanını zaten render eder, ayrıca closable gerekmez.
           Slot'a VDefaultsProvider ile `text: $vuetify.dismiss` varsayılanı
           enjekte edilir ama VBtn `icon` verildiğinde metin dalını hiç
           çalıştırmaz, o yüzden yazı basılmaz. -->
      <template #actions="{ props: closeProps }">
        <v-btn
          v-bind="closeProps"
          icon="mdi-close"
          variant="text"
          size="small"
          :aria-label="t('$vuetify.dismiss')"
        />
      </template>
    </v-snackbar-queue>

    <HotkeysHelp v-model="showHelp" />
    <LockScreen v-if="lock.isLocked" />
  </v-app>
</template>
