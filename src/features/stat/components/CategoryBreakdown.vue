<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { useCategoriesStore } from '@/features/categories/store'
import { useCurrenciesStore } from '@/features/currencies/store'
import { useFormat } from '@/composables/useFormat'
import type { BreakdownItem } from '@/features/stat/store'

/**
 * Sıralı kategori kırılımı.
 *
 * Neden pasta DEĞİL de çubuk: burada kapsam tüm cüzdanlar, kök kategori sayısı
 * 18'e kadar çıkabilir. 18 dilimli bir donut okunmaz; çubuk hem sıralamayı hem
 * kesin yüzdeyi verir ve sayı arttıkça bozulmaz. (Cüzdan detayındaki donut orada
 * doğru: kapsam tek cüzdan, dilim sayısı az.)
 */
defineProps<{ items: BreakdownItem[] }>()
const emit = defineEmits<{ drill: [categoryId: string] }>()

const { t } = useI18n()
const categoriesStore = useCategoriesStore()
const currenciesStore = useCurrenciesStore()
const fmt = useFormat()
</script>

<template>
  <div>
    <!-- İnilebilen satır <button>: tıklanabilir bir <div> klavye kullanıcısına
         görünmez, sekmeyle odaklanılamaz. -->
    <component
      :is="it.canDrill ? 'button' : 'div'"
      v-for="it in items"
      :key="it.categoryId"
      class="mb-3 stat-row"
      :class="it.canDrill && 'stat-row--drill'"
      :type="it.canDrill ? 'button' : undefined"
      :title="it.canDrill ? t('stat.drillHint', { name: categoriesStore.items[it.categoryId]?.name ?? it.categoryId }) : undefined"
      @click="it.canDrill && emit('drill', it.categoryId)"
    >
      <div class="d-flex align-center mb-1">
        <v-avatar :color="categoriesStore.items[it.categoryId]?.color || 'surface-variant'" size="28" class="me-2">
          <v-icon :icon="categoriesStore.items[it.categoryId]?.icon" color="white" size="16" />
        </v-avatar>
        <span class="text-body-2 text-truncate">
          {{ categoriesStore.items[it.categoryId]?.name ?? it.categoryId }}
        </span>
        <v-spacer />
        <span class="text-body-2 font-weight-medium">
          {{ fmt.money(it.amount, currenciesStore.base) }}
        </span>
        <span class="text-caption text-medium-emphasis ms-2 stat-row-pct">
          %{{ fmt.number(Math.round(it.percent)) }}
        </span>
        <!-- Yer her satırda ayrılır (visibility), yoksa inilebilen ve inilemeyen
             satırların yüzdeleri farklı hizalanırdı. -->
        <v-icon
          icon="mdi-chevron-right"
          size="14"
          class="ms-1 text-medium-emphasis"
          :style="{ visibility: it.canDrill ? 'visible' : 'hidden' }"
        />
      </div>
      <v-progress-linear
        :model-value="it.percent"
        :color="categoriesStore.items[it.categoryId]?.color || 'primary'"
        height="6"
      />
    </component>
  </div>
</template>

<style scoped>
/* <button> tarayıcı varsayılanlarını taşır (zemin, çerçeve, font) — sıfırlanmazsa
   inilebilen satırlar diğerlerinden farklı görünürdü. display/width şart: button
   satır içi davranır ve içeriğine göre daralır. */
.stat-row {
  display: block;
  width: 100%;
  background: none;
  border: 0;
  padding: 4px 6px;
  margin-inline: -6px;
  color: inherit;
  font: inherit;
  text-align: start;
  border-radius: max(0px, calc(var(--app-radius) - 6px));
}
.stat-row--drill {
  cursor: pointer;
}
.stat-row--drill:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
/* Yüzdeler sağda hizalı: değişken genişlikte olsalar sütun tırtıklı görünür. */
.stat-row-pct {
  min-width: 38px;
  text-align: end;
}
</style>
