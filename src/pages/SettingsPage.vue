<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { useSettingsStore, type ThemeMode } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'
import { MAX_RADIUS, MIN_RADIUS, neutralKeys, neutralPalettes, primaryPalette, type NeutralKey } from '@/features/theme/palette'
import { exportBackup, importBackup } from '@/services/backup'
import { clearAllData, seedDemoData } from '@/features/demo/seed'
import { useUserStore } from '@/features/user/store'
import { useLockStore } from '@/features/auth/useLockStore'
import SetPinDialog from '@/features/auth/SetPinDialog.vue'
import type { LocaleCode } from '@/i18n/messages'

const { t } = useI18n()
const settings = useSettingsStore()
const ui = useUiStore()
const userStore = useUserStore()
const lock = useLockStore()

const showSetPin = ref(false)

function onRemovePin() {
  lock.removePin()
  ui.showToast(t('settings.pinRemoved'), 'success')
}

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

const busy = ref(false)

async function onExport() {
  busy.value = true
  const r = await exportBackup()
  busy.value = false
  if (r === 'ok')
    ui.showToast(t('settings.backupOk'), 'success')
  else if (r === 'error')
    ui.showToast(t('settings.backupError'), 'error')
}

async function onImport() {
  busy.value = true
  const r = await importBackup()
  busy.value = false
  if (r === 'ok')
    ui.showToast(t('settings.importOk'), 'success')
  else if (r === 'error')
    ui.showToast(t('settings.backupError'), 'error')
}

const confirmClear = ref(false)

async function onLoadDemo() {
  busy.value = true
  try {
    await seedDemoData()
    ui.showToast(t('settings.demoLoaded'), 'success')
  }
  catch (e) {
    ui.showToast(`${t('settings.backupError')}: ${e instanceof Error ? e.message : String(e)}`, 'error')
  }
  finally {
    busy.value = false
  }
}

async function onClearData() {
  confirmClear.value = false
  busy.value = true
  try {
    await clearAllData()
    ui.showToast(t('settings.dataCleared'), 'success')
  }
  catch (e) {
    ui.showToast(`${t('settings.backupError')}: ${e instanceof Error ? e.message : String(e)}`, 'error')
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="pa-4">
    <div class="d-flex align-center mb-6">
      <v-icon icon="mdi-cog-outline" size="28" class="me-3" color="primary" />
      <h1 class="text-h5 font-weight-bold">{{ t('settings.title') }}</h1>
    </div>

    <!-- Görünüm -->
    <v-card variant="tonal" class="mb-4">
      <v-card-title class="text-subtitle-1">{{ t('settings.appearance') }}</v-card-title>
      <v-card-text>
        <div class="text-body-2 text-medium-emphasis mb-2">{{ t('settings.theme') }}</div>
        <v-btn-toggle
          :model-value="settings.themeMode"
          color="primary" density="comfortable" rounded="lg" mandatory divided class="mb-4"
          @update:model-value="settings.setThemeMode($event as ThemeMode)"
        >
          <v-btn v-for="opt in themeOptions" :key="opt.value" :value="opt.value" :prepend-icon="opt.icon">
            {{ opt.label }}
          </v-btn>
        </v-btn-toggle>

        <div class="text-body-2 text-medium-emphasis mb-2">{{ t('settings.primaryColor') }}</div>
        <div class="d-flex flex-wrap ga-2 mb-4">
          <button
            v-for="c in primaryPalette" :key="c" type="button" class="color-dot"
            :style="{ background: c, outline: settings.primaryColor === c ? '2px solid white' : 'none' }"
            @click="settings.setPrimaryColor(c)"
          />
        </div>

        <div class="text-body-2 text-medium-emphasis mb-2">{{ t('settings.neutral') }}</div>
        <div class="d-flex flex-wrap ga-2 mb-4">
          <button
            v-for="n in neutralKeys" :key="n" type="button" class="color-dot"
            :style="{ background: neutralPalettes[n].dark.surface, outline: settings.neutral === n ? '2px solid rgb(var(--v-theme-primary))' : '1px solid rgba(127,127,127,0.4)' }"
            :title="n"
            @click="settings.setNeutral(n as NeutralKey)"
          />
        </div>

        <div class="text-body-2 text-medium-emphasis mb-1">{{ t('settings.radius') }} ({{ settings.radius }}px)</div>
        <v-slider
          :model-value="settings.radius"
          :min="MIN_RADIUS" :max="MAX_RADIUS" :step="1"
          color="primary" hide-details density="compact"
          @update:model-value="settings.setRadius($event)"
        />
      </v-card-text>
    </v-card>

    <!-- Profil ve güvenlik -->
    <v-card variant="tonal" class="mb-4">
      <v-card-title class="text-subtitle-1">{{ t('settings.profile') }}</v-card-title>
      <v-card-text>
        <v-text-field
          :model-value="userStore.displayName"
          :label="t('settings.displayName')"
          prepend-inner-icon="mdi-account-outline"
          class="mb-2"
          @update:model-value="userStore.setDisplayName($event)"
        />
        <div class="d-flex ga-2 flex-wrap">
          <v-btn v-if="!lock.hasPin" variant="tonal" prepend-icon="mdi-lock-outline" @click="showSetPin = true">
            {{ t('settings.setPin') }}
          </v-btn>
          <template v-else>
            <v-btn variant="tonal" prepend-icon="mdi-lock-reset" @click="showSetPin = true">
              {{ t('settings.changePin') }}
            </v-btn>
            <v-btn variant="tonal" color="error" prepend-icon="mdi-lock-open-variant-outline" @click="onRemovePin">
              {{ t('settings.removePin') }}
            </v-btn>
          </template>
        </div>
      </v-card-text>
    </v-card>

    <!-- Dil -->
    <v-card variant="tonal" class="mb-4">
      <v-card-title class="text-subtitle-1">{{ t('settings.language') }}</v-card-title>
      <v-card-text>
        <v-select
          :model-value="settings.locale"
          :items="localeOptions" item-title="label" item-value="value" hide-details
          @update:model-value="settings.setAppLocale($event as LocaleCode)"
        />
      </v-card-text>
    </v-card>

    <!-- Veri / Yedekleme -->
    <v-card variant="tonal">
      <v-card-title class="text-subtitle-1">{{ t('settings.data') }}</v-card-title>
      <v-card-text class="d-flex ga-2 flex-wrap">
        <v-btn variant="tonal" prepend-icon="mdi-export" :loading="busy" @click="onExport">
          {{ t('settings.exportBackup') }}
        </v-btn>
        <v-btn variant="tonal" prepend-icon="mdi-import" :loading="busy" @click="onImport">
          {{ t('settings.importBackup') }}
        </v-btn>
        <v-btn variant="tonal" prepend-icon="mdi-database-plus-outline" :loading="busy" @click="onLoadDemo">
          {{ t('settings.loadDemo') }}
        </v-btn>
        <v-btn variant="tonal" color="error" prepend-icon="mdi-delete-outline" :loading="busy" @click="confirmClear = true">
          {{ t('settings.clearData') }}
        </v-btn>
      </v-card-text>
    </v-card>

    <v-dialog v-model="confirmClear" max-width="360">
      <v-card>
        <v-card-text>{{ t('settings.clearConfirm') }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmClear = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="error" variant="flat" @click="onClearData">{{ t('settings.clearData') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <SetPinDialog v-model="showSetPin" />

    <div class="text-caption text-medium-emphasis mt-6 text-center">
      Weltoly · v0.1.0
    </div>
  </div>
</template>

<style scoped>
.color-dot { width: 30px; height: 30px; border-radius: 50%; outline-offset: 2px; cursor: pointer; }
</style>
