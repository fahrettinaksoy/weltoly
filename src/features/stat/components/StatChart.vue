<script setup lang="ts">
import { useTheme } from 'vuetify'
import { useI18n } from 'vue-i18n'
import { format } from 'date-fns'
import VChart from 'vue-echarts'

import type { Period } from '@/features/date/types'
import type { ChartInterval } from '@/features/stat/store'

const props = defineProps<{ series: ChartInterval[], period: Period }>()

const theme = useTheme()
const { t } = useI18n()

const colors = computed(() => theme.current.value.colors)

const labelFmt: Record<Period, string> = { day: 'd MMM', week: 'd MMM', month: 'MMM', year: 'yyyy' }

const labels = computed(() => props.series.map(s => format(s.range.start, labelFmt[props.period])))
const incomeData = computed(() => props.series.map(s => Math.round(s.income)))
const expenseData = computed(() => props.series.map(s => Math.round(s.expense)))

const option = computed(() => {
  const onSurface = colors.value['on-surface'] ?? '#888'
  const gridLine = theme.current.value.dark ? '#ffffff14' : '#00000010'
  return {
    grid: { left: 8, right: 8, top: 28, bottom: 24, containLabel: true },
    tooltip: { trigger: 'axis' },
    legend: {
      data: [t('trnForm.income'), t('trnForm.expense')],
      textStyle: { color: onSurface },
      top: 0,
    },
    xAxis: {
      type: 'category',
      data: labels.value,
      axisLabel: { color: onSurface, fontSize: 10 },
      axisLine: { lineStyle: { color: gridLine } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: onSurface, fontSize: 10 },
      splitLine: { lineStyle: { color: gridLine } },
    },
    series: [
      {
        name: t('trnForm.income'),
        type: 'bar',
        data: incomeData.value,
        itemStyle: { color: colors.value.success, borderRadius: [4, 4, 0, 0] },
      },
      {
        name: t('trnForm.expense'),
        type: 'bar',
        data: expenseData.value,
        itemStyle: { color: colors.value.error, borderRadius: [4, 4, 0, 0] },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: colors.value.error, type: 'dashed', opacity: 0.6 },
          data: [{ type: 'average' }],
        },
      },
    ],
  }
})
</script>

<template>
  <VChart :option="option" autoresize style="height: 240px;" />
</template>
