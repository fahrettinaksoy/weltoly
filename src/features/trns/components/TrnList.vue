<script setup lang="ts">
import { format, isToday, isYesterday } from 'date-fns'

import { useTrnsStore } from '@/features/trns/store'
import { useFormat } from '@/composables/useFormat'
import TrnItem from '@/features/trns/components/TrnItem.vue'

const props = defineProps<{ ids: string[] }>()

const trnsStore = useTrnsStore()
const fmt = useFormat()

// Günlere göre grupla (tarih azalan).
const groups = computed(() => {
  const map = new Map<string, { label: string, ts: number, ids: string[] }>()
  for (const id of props.ids) {
    const trn = trnsStore.items?.[id]
    if (!trn)
      continue
    const d = new Date(trn.date)
    const key = format(d, 'yyyy-MM-dd')
    if (!map.has(key)) {
      const label = isToday(d) ? 'today' : isYesterday(d) ? 'yesterday' : fmt.date(d)
      map.set(key, { label, ts: trn.date, ids: [] })
    }
    map.get(key)!.ids.push(id)
  }
  return [...map.values()].sort((a, b) => b.ts - a.ts)
})
</script>

<template>
  <div>
    <div v-for="g in groups" :key="g.ts" class="mb-2">
      <div class="text-caption text-medium-emphasis px-2 mb-1 text-uppercase">
        {{ g.label === 'today' ? $t('trns.today') : g.label === 'yesterday' ? $t('trns.yesterday') : g.label }}
      </div>
      <TrnItem v-for="id in g.ids" :key="id" :id="id" />
    </div>
  </div>
</template>
