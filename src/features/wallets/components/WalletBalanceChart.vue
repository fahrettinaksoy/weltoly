<script setup lang="ts">
import { useTheme } from 'vuetify'
import { useI18n } from 'vue-i18n'
import { format } from 'date-fns'
import VChart from 'vue-echarts'

import { TrnType, type TrnId, type TrnItem } from '@/features/trns/types'
import AppEmptyState from '@/components/AppEmptyState.vue'

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

/** İşlemin bu cüzdana etkisi (işaretli). Transferde cüzdan iki tarafta da olabilir. */
function signedAmount(trn: TrnItem): number {
  if (trn.type === TrnType.Transfer) {
    let sum = 0
    if (trn.expenseWalletId === props.walletId)
      sum -= trn.expenseAmount
    if (trn.incomeWalletId === props.walletId)
      sum += trn.incomeAmount
    return sum
  }
  return trn.type === TrnType.Income ? trn.amount : -trn.amount
}

/**
 * Bakiye seyri.
 *
 * Geçmiş bakiye BUGÜNDEN GERİYE hesaplanır: elimizde yalnız güncel bakiye ve
 * işlemler var, bir "açılış bakiyesi" alanı yok. İleriye doğru toplasaydık
 * dönemden ÖNCEKİ işlemleri kaçırır ve seri yanlış bir taban etrafında gezerdi.
 * Geriye giderken her işlemin etkisi çıkarılır → o işlemden önceki bakiye.
 */
const series = computed(() => {
  const sorted = props.trns.toSorted((a, b) => a.trn.date - b.trn.date)
  if (!sorted.length)
    return [] as { date: number, balance: number }[]

  // Sondan başa: bakiye_i = bakiye_{i+1} - etki_{i+1}
  const points: { date: number, balance: number }[] = []
  let running = props.currentBalance
  for (let i = sorted.length - 1; i >= 0; i--) {
    points.unshift({ date: sorted[i]!.trn.date, balance: running })
    running -= signedAmount(sorted[i]!.trn)
  }
  // Dönemin başındaki (ilk işlemden önceki) bakiye
  points.unshift({ date: sorted[0]!.trn.date - 86_400_000, balance: running })
  return points
})

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
