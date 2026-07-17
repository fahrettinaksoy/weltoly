<script setup lang="ts">
import { useFormat } from '@/composables/useFormat'
import { deltaTone } from '@/features/stat/lib/periodCompare'

/**
 * Tek bir KPI kartı: büyük rakam + önceki döneme kıyas rozeti + etiket (A-6).
 *
 * Panel ve İstatistik sayfalarında BİREBİR aynı 24 satırlık markup duruyordu;
 * `dash-kpi`/`stat-kpi` CSS'i bile aynıydı (`min-width: 150px`), yalnız sınıf adı
 * farklıydı. İki kopya sessizce ayrışır: birinde rozetin rengi/eşiği değişince
 * diğeri eski davranışta kalır ve aynı kavram iki ekranda farklı görünür.
 *
 * Cüzdanlar sayfasındaki KPI'lar BİLİNÇLİ OLARAK buraya alınmadı: onlar kıyas
 * rozeti taşımıyor, değerleri önceden biçimlenmiş geliyor ve donut'la aynı
 * v-sheet'i paylaşıyorlar. Benzer GÖRÜNEN ama farklı olan şeyi tek bileşene
 * zorlamak, her iki çağıranı da bozan seçenek bayrakları üretirdi.
 */
const props = defineProps<{
  /** Ham değer — biçimlendirme `money`'ye göre burada yapılır. */
  value: number
  /** true → para olarak biçimle (currency gerekir), false → düz sayı. */
  money: boolean
  /**
   * Para birimi. `money` false iken yok sayılır ama her iki çağıran da temel
   * para birimini geçiyor; opsiyonel yapmak fmt.money'ye undefined sızdırırdı.
   */
  currency: string
  /** Rakamın renk sınıfı (ör. 'text-success'). Boş = varsayılan. */
  tone?: string
  /** Önceki döneme göre % değişim. null = kıyas yok (rozet gizlenir). */
  delta: number | null
  /** Artışın iyi mi kötü mü olduğu — rozet rengini belirler (gider için false). */
  positiveIsGood: boolean
  label: string
  /** Rozetin tooltip'i: kıyasın NEYE göre olduğunu söyler. */
  deltaTitle?: string
}>()

const fmt = useFormat()

// `money` true iken currency verilmemişse fmt.money para birimsiz biçimler;
// çağıranların ikisi de temel para birimini geçiyor.
const display = computed(() =>
  props.money ? fmt.money(props.value, props.currency) : fmt.number(props.value),
)
</script>

<template>
  <v-sheet color="surface-light" class="pa-4 flex-1-1 kpi-card">
    <div class="d-flex align-center ga-2">
      <div class="text-h5 font-weight-bold text-truncate" :class="tone">
        {{ display }}
      </div>
      <v-chip
        v-if="delta !== null"
        :color="deltaTone(delta, positiveIsGood)"
        :prepend-icon="delta >= 0 ? 'mdi-arrow-up' : 'mdi-arrow-down'"
        size="x-small"
        variant="tonal"
        :title="deltaTitle"
      >
        {{ fmt.percent(Math.abs(delta)) }}
      </v-chip>
    </div>
    <div class="text-caption text-medium-emphasis">
      <slot name="label">
        {{ label }}
      </slot>
    </div>
  </v-sheet>
</template>

<style scoped>
.kpi-card {
  min-width: 150px;
}
</style>
