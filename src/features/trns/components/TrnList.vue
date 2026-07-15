<script setup lang="ts">
import { format, isToday, isYesterday } from 'date-fns'

import { useTrnsStore } from '@/features/trns/store'
import { useFormat } from '@/composables/useFormat'
import TrnItem from '@/features/trns/components/TrnItem.vue'

const props = defineProps<{
  ids: string[]
  /** Gösterilecek GÜN sayısı. Verilmezse hepsi. */
  maxGroups?: number
}>()

/** Açık başlayan gün sayısı: yalnız en yeni gün. Kalanlar kapalı — düz liste
    kartı ekranın çok ötesine uzatıyordu. */
const OPEN_BY_DEFAULT = 1

const trnsStore = useTrnsStore()
const fmt = useFormat()

/**
 * Günlere göre grupla (tarih azalan), sonra ilk `maxGroups` günü al.
 *
 * Kesme GÜN bazında, işlem bazında değil: çağıran "son 5 gün" istiyor. Girdiyi
 * önceden "ilk 50 işlem" diye kırpmak beşinci günü ortasından bölerdi — ekranda
 * o günün bir kısmı görünür, gerisi sessizce yok olurdu.
 *
 * Kesme gruplama BİTTİKTEN sonra: erken çıkmak girdinin sıralı geldiğini
 * varsaymak olurdu, bu bileşen ise sıralamayı kendi yapıyor (aşağıdaki sort).
 */
const groups = computed(() => {
  const map = new Map<string, { key: string, label: string, ts: number, ids: string[] }>()
  for (const id of props.ids) {
    const trn = trnsStore.items?.[id]
    if (!trn)
      continue
    const d = new Date(trn.date)
    const key = format(d, 'yyyy-MM-dd')
    if (!map.has(key)) {
      const label = isToday(d) ? 'today' : isYesterday(d) ? 'yesterday' : fmt.date(d)
      map.set(key, { key, label, ts: trn.date, ids: [] })
    }
    map.get(key)!.ids.push(id)
  }
  const all = [...map.values()].sort((a, b) => b.ts - a.ts)
  return props.maxGroups ? all.slice(0, props.maxGroups) : all
})

/**
 * Açık paneller. ref + watch, computed DEĞİL: computed olsaydı kullanıcının elle
 * açıp kapattığı her panel bir sonraki yeniden hesapta geri alınırdı.
 *
 * Gün KÜMESİ değişince (etiket süzgeci, yeni kayıt) ilk üçe dönülür — eski
 * anahtarlar artık yoksa hiçbir panel açık kalmaz ve liste boş görünürdü.
 * Anahtarlar birleştirilip izleniyor: `groups`'un kendisini izlemek her yeniden
 * hesapta (dizi kimliği değişir) boşuna tetiklerdi.
 */
const openPanels = ref<string[]>([])
watch(
  () => groups.value.map(g => g.key).join('|'),
  () => {
    openPanels.value = groups.value.slice(0, OPEN_BY_DEFAULT).map(g => g.key)
  },
  { immediate: true },
)
</script>

<template>
  <!-- variant="accordion": paneller arasında boşluk/elevation yok, liste gibi
       aksın. bg-color transparent: kartın kendi yüzeyi zaten var, panel ikinci
       bir zemin bindirirse ton kirlenir. -->
  <v-expansion-panels v-model="openPanels" multiple variant="accordion" flat class="trn-groups">
    <v-expansion-panel
      v-for="g in groups"
      :key="g.key"
      :value="g.key"
      bg-color="transparent"
      elevation="0"
    >
      <v-expansion-panel-title>
        <span class="text-body-small text-medium-emphasis text-uppercase">
          {{ g.label === 'today' ? $t('trns.today') : g.label === 'yesterday' ? $t('trns.yesterday') : g.label }}
        </span>
        <v-spacer />
        <!-- Adet kapalıyken de görünür: paneli açmadan "o gün kaç hareket olmuş"
             sorusunu yanıtlar. me-2 → varsayılan açılma okuna yapışmasın. -->
        <span class="text-body-small text-disabled me-2">{{ fmt.number(g.ids.length) }}</span>
      </v-expansion-panel-title>

      <v-expansion-panel-text>
        <TrnItem v-for="id in g.ids" :id="id" :key="id" />
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<style scoped>
/* Vuetify panel gövdesine yatay dolgu verir; TrnItem kendi dolgusunu taşıdığı
   için satırlar başlığa göre içeri kaçıyordu. */
.trn-groups :deep(.v-expansion-panel-text__wrapper) {
  padding: 0;
}
/* Gün ayracı liste başlığı gibi dursun: varsayılan panel başlığı yüksekliği
   (48px+) bunun için fazla, liste seyrek/tırtıklı görünüyordu. */
.trn-groups :deep(.v-expansion-panel-title) {
  min-height: 40px;
  padding-block: 4px;
}
</style>
