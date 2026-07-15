<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const { t } = useI18n()

const rows = computed(() => [
  { keys: ['n'], label: t('hotkeys.newTrn') },
  { keys: ['g', 'd'], label: t('nav.dashboard') },
  { keys: ['g', 'w'], label: t('nav.wallets') },
  { keys: ['g', 'c'], label: t('nav.categories') },
  { keys: ['g', 's'], label: t('nav.stat') },
  { keys: ['g', 'e'], label: t('nav.settings') },
  { keys: ['shift', '?'], label: t('hotkeys.help') },
])
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="420" @update:model-value="emit('update:modelValue', $event)">
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon icon="mdi-keyboard-outline" class="me-2" />
        {{ t('hotkeys.title') }}
      </v-card-title>
      <v-card-text>
        <div v-for="(r, i) in rows" :key="i" class="d-flex align-center justify-space-between py-2">
          <span class="text-body-medium">{{ r.label }}</span>
          <span class="d-flex ga-1">
            <kbd v-for="k in r.keys" :key="k" class="kbd">{{ k }}</kbd>
          </span>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped>
/* Tuş rozeti: küçük bir yüzey → ayarı izler. Diyalogun içinde durduğu için
   bir tık daha az yuvarlanır (eşmerkezli köşe). */
.kbd {
  padding: 2px 8px;
  border-radius: max(0px, calc(var(--app-radius) - 4px));
  font-family: monospace;
  font-size: 12px;
  background: rgb(var(--v-theme-surface-light));
  border: 1px solid rgba(127, 127, 127, 0.3);
}
</style>
