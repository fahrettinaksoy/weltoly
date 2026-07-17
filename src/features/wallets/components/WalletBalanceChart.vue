<script setup lang="ts">
import type { TrnId, TrnItem } from '@/features/trns/types'
import { format } from 'date-fns'
import VChart from 'vue-echarts'
import { useI18n } from 'vue-i18n'
import { useTheme } from 'vuetify'

import AppEmptyState from '@/components/AppEmptyState.vue'
import { buildBalanceSeries } from '@/features/wallets/lib/balanceSeries'
// ECharts modül kaydı — bkz. StatChart.vue'daki not (lazy chunk'a düşsün).
import '@/plugins/echarts'

const props = defineProps<{
  trns: { id: TrnId, trn: TrnItem }[]
  walletId: string
  /** Cüzdanın BUGÜNKÜ bakiyesi — seri bundan geriye doğru kurulur. */
  currentBalance: number
  currency: string
}>()

const theme = useTheme()
const { t } = useI18n()
const fmt = useFormat()

// Seri mantığı features/wallets/lib/balanceSeries.ts'te — TEK KAYNAK (Y-5).
// Testler de aynı modülü import eder; bileşen içinde kopyası YOK.
const series = computed(() =>
  buildBalanceSeries(props.trns.map(x => x.trn), props.walletId, props.currentBalance),
)

const colors = computed(() => theme.current.value.colors)

const option = computed(() => {
  const onSurface = colors.value['on-surface'] ?? '#888'
  const primary = colors.value.primary ?? '#1976d2'
  const gridLine = theme.current.value.dark ? '#ffffff14' : '#00000010'

  return {
    grid: { left: 8, right: 12, top: 16, bottom: 24, containLabel: true },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (v: number) => fmt.money(v, props.currency),
    },
    xAxis: {
      type: 'category',
      data: series.value.map(p => format(p.date, 'd MMM')),
      axisLabel: { color: onSurface, fontSize: 10 },
      axisLine: { lineStyle: { color: gridLine } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: onSurface, fontSize: 10 },
      splitLine: { lineStyle: { color: gridLine } },
    },
    series: [{
      type: 'line',
      smooth: true,
      showSymbol: false,
      data: series.value.map(p => Math.round(p.balance)),
      lineStyle: { color: primary, width: 2 },
      areaStyle: { color: primary, opacity: 0.12 },
      // Sıfır çizgisi: bakiye eksiye geçtiğinde göz onu arıyor.
      markLine: {
        silent: true,
        symbol: 'none',
        data: [{ yAxis: 0 }],
        lineStyle: { color: onSurface, opacity: 0.35, type: 'dashed' },
        label: { show: false },
      },
    }],
  }
})
</script>

<template>
  <!-- Yükseklik zincirinin kopmaması için sarmalayıcı da %100 (aşağıdaki CSS). -->
  <div v-if="!series.length" class="d-flex align-center justify-center balance-empty">
    <AppEmptyState density="compact" icon="mdi-chart-line" :title="t('walletDetail.noTrns')" />
  </div>
  <VChart v-else :option="option" autoresize class="balance-chart" />
</template>

<style scoped>
/* Grafik kartın verdiği yüksekliği doldurur: satır yüksekliğini kategori kartı
   belirliyor, grafik ona uyuyor. min-height: kategori çok kısaysa (az kategori)
   grafik okunmaz hale gelmesin. */
.balance-chart {
  height: 100%;
  min-height: 200px;
  width: 100%;
}

/* Boş durum da yüksekliği korur, yoksa işlemsiz cüzdanda kart çöker. */
.balance-empty {
  height: 100%;
  min-height: 200px;
}
</style>
