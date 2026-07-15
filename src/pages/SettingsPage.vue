<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { useSettingsStore, type ThemeMode } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'
import { MAX_RADIUS, MIN_RADIUS, neutralKeys, neutralPalettes, primaryPalette, type NeutralKey } from '@/features/theme/palette'
import ColorSwatches from '@/components/ColorSwatches.vue'
import SectionCard from '@/components/SectionCard.vue'
import { exportBackup, importBackup } from '@/services/backup'
import { clearAllData, seedDemoData } from '@/features/demo/seed'
import { useUserStore } from '@/features/user/store'
import { useLockStore } from '@/features/auth/useLockStore'
import SetPinDialog from '@/features/auth/SetPinDialog.vue'
import { allCurrencies } from '@/features/currencies/list'
import { DATE_FORMATS, NUMBER_FORMATS, type DateFormatKey, type NumberFormatKey, type WeekStart } from '@/shared/lib/format'
import type { CurrencyCode } from '@/features/currencies/types'
import type { LocaleCode } from '@/i18n/messages'

const { t } = useI18n()
const settings = useSettingsStore()
const ui = useUiStore()
const userStore = useUserStore()
const lock = useLockStore()

// Sağdaki dikey sekmeler — etiket, bölüm başlığı görevini görür.
const tab = ref('appearance')
const tabItems = computed(() => [
  { value: 'appearance', icon: 'mdi-palette-outline', label: t('settings.appearance'), desc: t('settings.tabDesc.appearance') },
  { value: 'profile', icon: 'mdi-account-outline', label: t('settings.profile'), desc: t('settings.tabDesc.profile') },
  { value: 'localization', icon: 'mdi-translate', label: t('settings.localization'), desc: t('settings.tabDesc.localization') },
  { value: 'data', icon: 'mdi-database-outline', label: t('settings.data'), desc: t('settings.tabDesc.data') },
])

// İçerik başlığı aktif sekmeyi izler: "burada ne yapılır" açıklaması.
const activeTab = computed(() => tabItems.value.find(i => i.value === tab.value) ?? tabItems.value[0]!)

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

// Varsayılan (temel) para birimi seçenekleri — "USD — US Dollar".
const currencyOptions = allCurrencies.map(c => ({ value: c.code, label: `${c.code} — ${c.name}` }))

// Biçimlendirme seçenekleri — 'auto' dile göre; diğerleri örnek gösterimle.
const numberFormatOptions = computed(() => NUMBER_FORMATS.map(f => ({
  value: f.key,
  label: f.key === 'auto' ? t('settings.formatAuto') : f.sample,
})))
const dateFormatOptions = computed(() => DATE_FORMATS.map(f => ({
  value: f.key,
  label: f.key === 'auto' ? t('settings.formatAuto') : f.sample,
})))
const weekStartOptions = computed(() => [
  { value: 1 as WeekStart, label: t('settings.monday') },
  { value: 0 as WeekStart, label: t('settings.sunday') },
])

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
    <div class="d-flex ga-4 align-start">
      <!-- İçerik (sol) -->
      <div class="flex-grow-1 settings-window">
        <!-- Aktif sekmenin başlığı + burada ne yapıldığının açıklaması -->
        <div class="d-flex align-center ga-3 mb-4">
          <v-avatar color="primary" variant="tonal" size="40">
            <v-icon :icon="activeTab.icon" size="22" />
          </v-avatar>
          <div class="overflow-hidden">
            <div class="text-title-medium font-weight-bold">{{ activeTab.label }}</div>
            <div class="text-body-small text-medium-emphasis">{{ activeTab.desc }}</div>
          </div>
        </div>
        <v-divider class="mb-4" />

        <v-tabs-window v-model="tab">
        <!-- Görünüm -->
        <v-tabs-window-item value="appearance">
          <SectionCard
            :title="t('settings.groupTheme')"
            :subtitle="t('settings.groupThemeDesc')"
            icon="mdi-palette-outline"
          >
              <div class="text-body-medium text-medium-emphasis mb-2">{{ t('settings.theme') }}</div>
              <v-btn-toggle
                :model-value="settings.themeMode"
                color="primary" density="comfortable" mandatory class="mb-4"
                @update:model-value="settings.setThemeMode($event as ThemeMode)"
              >
                <v-btn v-for="opt in themeOptions" :key="opt.value" :value="opt.value" :prepend-icon="opt.icon">
                  {{ opt.label }}
                </v-btn>
              </v-btn-toggle>

              <div class="text-body-medium text-medium-emphasis mb-2">{{ t('settings.primaryColor') }}</div>
              <ColorSwatches
                :model-value="settings.primaryColor"
                :colors="primaryPalette"
                class="mb-4"
                @update:model-value="settings.setPrimaryColor($event)"
              />

              <div class="text-body-medium text-medium-emphasis mb-2">{{ t('settings.neutral') }}</div>
              <div class="d-flex flex-wrap ga-2 mb-4">
                <button
                  v-for="n in neutralKeys" :key="n" type="button" class="neutral-swatch"
                  :style="{ background: neutralPalettes[n].dark.surface }"
                  :title="n"
                  :aria-pressed="settings.neutral === n"
                  @click="settings.setNeutral(n as NeutralKey)"
                >
                  <v-icon v-if="settings.neutral === n" icon="mdi-check" size="18" color="white" class="neutral-check" />
                </button>
              </div>

              <div class="text-body-medium text-medium-emphasis mb-1">{{ t('settings.radius') }} ({{ settings.radius }}px)</div>
              <v-slider
                :model-value="settings.radius"
                :min="MIN_RADIUS" :max="MAX_RADIUS" :step="1"
                color="primary" hide-details density="compact"
                @update:model-value="settings.setRadius($event)"
              />
          </SectionCard>
        </v-tabs-window-item>

        <!-- Profil ve güvenlik -->
        <v-tabs-window-item value="profile">
          <SectionCard
            :title="t('settings.groupAccount')"
            :subtitle="t('settings.groupAccountDesc')"
            icon="mdi-shield-account-outline"
          >
              <v-text-field
                :model-value="userStore.displayName"
                :label="t('settings.displayName')"
                prepend-inner-icon="mdi-account-outline"
                class="mb-4"
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
          </SectionCard>
        </v-tabs-window-item>

        <!-- Yerelleştirme: 2 kart (dil & para birimi + biçimlendirme) -->
        <v-tabs-window-item value="localization">
          <!-- Kart 1: Dil ve para birimi -->
          <SectionCard
            :title="t('settings.groupLang')"
            :subtitle="t('settings.groupLangDesc')"
            icon="mdi-translate"
            class="mb-4"
          >
              <div class="text-body-medium text-medium-emphasis mb-2">{{ t('settings.language') }}</div>
              <v-select
                :model-value="settings.locale"
                :items="localeOptions" item-title="label" item-value="value" hide-details
                class="mb-4"
                @update:model-value="settings.setAppLocale($event as LocaleCode)"
              />

              <div class="text-body-medium text-medium-emphasis mb-2">{{ t('settings.currency') }}</div>
              <v-select
                :model-value="userStore.baseCurrency"
                :items="currencyOptions" item-title="label" item-value="value" hide-details
                prepend-inner-icon="mdi-currency-usd"
                @update:model-value="userStore.saveUserBaseCurrency($event as CurrencyCode)"
              />
          </SectionCard>

          <!-- Kart 2: Biçimlendirme -->
          <SectionCard
            :title="t('settings.formatting')"
            :subtitle="t('settings.formattingHint')"
            icon="mdi-numeric"
          >

              <v-row dense>
                <v-col cols="12" sm="4">
                  <v-select
                    :model-value="settings.numberFormat"
                    :items="numberFormatOptions" item-title="label" item-value="value" hide-details
                    :label="t('settings.numbers')"
                    @update:model-value="settings.setNumberFormat($event as NumberFormatKey)"
                  />
                </v-col>
                <v-col cols="12" sm="4">
                  <v-select
                    :model-value="settings.dateFormat"
                    :items="dateFormatOptions" item-title="label" item-value="value" hide-details
                    :label="t('settings.dates')"
                    @update:model-value="settings.setDateFormat($event as DateFormatKey)"
                  />
                </v-col>
                <v-col cols="12" sm="4">
                  <v-select
                    :model-value="settings.weekStart"
                    :items="weekStartOptions" item-title="label" item-value="value" hide-details
                    :label="t('settings.firstDayOfWeek')"
                    @update:model-value="settings.setWeekStart($event as WeekStart)"
                  />
                </v-col>
              </v-row>

              <v-checkbox
                :model-value="settings.hideDecimals"
                :label="t('settings.hideDecimals')" hide-details density="comfortable" class="mt-2"
                @update:model-value="settings.setHideDecimals(!!$event)"
              />
          </SectionCard>
        </v-tabs-window-item>

        <!-- Veri / Yedekleme -->
        <v-tabs-window-item value="data">
          <SectionCard
            :title="t('settings.groupData')"
            :subtitle="t('settings.groupDataDesc')"
            icon="mdi-database-outline"
          >
              <div class="d-flex ga-2 flex-wrap">
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
              </div>
          </SectionCard>
        </v-tabs-window-item>
        </v-tabs-window>
      </div>

      <!-- Sekmeler (sağda, dikey) -->
      <!-- hide-slider: MD3'te aktif sekme çizgiyle değil, tonal zeminle belirtilir. -->
      <v-tabs
        v-model="tab"
        direction="vertical"
        color="primary"
        hide-slider
        class="settings-tabs flex-0-0"
      >
        <v-tab
          v-for="it in tabItems"
          :key="it.value"
          :value="it.value"
          :prepend-icon="it.icon"
          class="justify-start"
        >
          {{ it.label }}
        </v-tab>
      </v-tabs>
    </div>

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
  </div>
</template>

<style scoped>
.settings-tabs {
  min-width: 190px;
}

/* Aktif sekme: soldaki çizgi (slider) yerine tonal primary zemin.
   Zemin 0.12 opaklıkla primary: tema/palet değişince birlikte kayar.
   Aynı desen bant sekmelerinde de var (DefaultLayout .header-tabs).

   Yuvarlaklık ayardan gelir: VTab içeride bir VBtn render eder, `.v-tab` sınıfı
   o butonun üzerindedir → defaults.ts'teki VBtn.rounded ona da iner. Vuetify'ın
   `.v-tab { border-radius: 0 }` kuralını (VTab.css, @layer vuetify-overrides)
   default'un ürettiği INLINE style yener — mesele katman değil, inline olması.
   (Radius artık app.css'te DEĞİL; bu yorum eskiden oraya işaret ediyordu.) */
.settings-tabs :deep(.v-tab--selected) {
  background: rgba(var(--v-theme-primary), 0.12);
}

/* Pill'ler birbirine yapışmasın. */
.settings-tabs :deep(.v-tab) {
  margin-bottom: 4px;
}
/* İçerik alanı esnesin, taşan uzun metinler sıkıştırmasın. */
.settings-window {
  min-width: 0;
}
/* Vuetify bileşeni değil (düz <button>) → defaults ulaşmaz. */
.neutral-swatch {
  width: 32px; height: 32px; border-radius: var(--app-radius); cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  transition: transform 0.12s ease;
}
.neutral-swatch:hover { transform: scale(1.12); }
.neutral-check { filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6)); }
</style>
