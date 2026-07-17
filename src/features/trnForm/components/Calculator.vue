<script setup lang="ts">
import type { CalculatorKey } from '@/features/trnForm/utils/calculate'
import { useI18n } from 'vue-i18n'

const emit = defineEmits<{ key: [CalculatorKey] }>()

// Silme tuşunun etiketi ikon olduğu için ekran okuyucuya METİN gerekir; bu metin
// çeviriden gelmeli — sabit 'Sil' yazılınca en/ru kullanıcısı Türkçe duyuyordu.
const { t } = useI18n()

interface Btn { k: CalculatorKey, label?: string, icon?: string, color?: string }

const rows: Btn[][] = [
  [{ k: '7' }, { k: '8' }, { k: '9' }, { k: '/', label: '÷', color: 'primary' }],
  [{ k: '4' }, { k: '5' }, { k: '6' }, { k: '*', label: '×', color: 'primary' }],
  [{ k: '1' }, { k: '2' }, { k: '3' }, { k: '-', label: '−', color: 'primary' }],
  [{ k: '.' }, { k: '0' }, { k: 'c', icon: 'mdi-backspace-outline' }, { k: '+', label: '+', color: 'primary' }],
]
</script>

<template>
  <!-- defaults-provider: hesap makinesi tuşlarına kapsam-içi ortak varsayılanlar (DRY). -->
  <v-defaults-provider :defaults="{ VBtn: { variant: 'tonal', size: 'large', rounded: 'lg' } }">
    <div class="calc">
      <div v-for="(row, ri) in rows" :key="ri" class="calc-row">
        <v-btn
          v-for="btn in row"
          :key="btn.k"
          :color="btn.color"
          class="calc-btn"
          :aria-label="btn.k === 'c' ? t('a11y.calcDelete') : (btn.label ?? btn.k)"
          @click="emit('key', btn.k)"
        >
          <v-icon v-if="btn.icon" :icon="btn.icon" />
          <span v-else class="text-h6">{{ btn.label ?? btn.k }}</span>
        </v-btn>
      </div>
    </div>
  </v-defaults-provider>
</template>

<style scoped>
.calc { display: flex; flex-direction: column; gap: 8px; }
.calc-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.calc-btn { min-height: 52px; }
</style>
