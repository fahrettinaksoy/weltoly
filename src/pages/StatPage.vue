<script setup lang="ts">
import type { Period } from '@/features/date/types'
import type { StatType } from '@/features/stat/store'

import { format } from 'date-fns'
import { useI18n } from 'vue-i18n'
import AppEmptyState from '@/components/AppEmptyState.vue'
import KpiCard from '@/components/KpiCard.vue'
import SectionCard from '@/components/SectionCard.vue'
import { useFormat } from '@/composables/useFormat'
import { useCategoriesStore } from '@/features/categories/store'
import { useCurrenciesStore } from '@/features/currencies/store'
import CategoryBreakdown from '@/features/stat/components/CategoryBreakdown.vue'
import StatChart from '@/features/stat/components/StatChart.vue'
import { changeRatio } from '@/features/stat/lib/periodCompare'
import { useStatStore } from '@/features/stat/store'
import { useTagsStore } from '@/features/tags/store'
import { useWalletsStore } from '@/features/wallets/store'

const { t } = useI18n()
const stat = useStatStore()
const currenciesStore = useCurrenciesStore()
const walletsStore = useWalletsStore()
const categoriesStore = useCategoriesStore()
const tagsStore = useTagsStore()
const fmt = useFormat()

const walletFilterItems = computed(() =>
  walletsStore.sortedIds.map(id => ({ id, name: walletsStore.items?.[id]?.name ?? id })),
)

const tagFilterItems = computed(() =>
  tagsStore.sortedIds.map(id => ({ id, name: tagsStore.items[id]?.name ?? id })),
)

const periods: { value: Period, label: string }[] = [
  { value: 'day', label: t('stat.day') },
  { value: 'week', label: t('stat.week') },
  { value: 'month', label: t('stat.month') },
  { value: 'year', label: t('stat.year') },
]

const rangeLabel = computed<string>(() => {
  const { start, end } = stat.currentRange
  switch (stat.period) {
    case 'day': return format(start, 'd MMMM yyyy')
    case 'week': return `${format(start, 'd MMM')} – ${format(end, 'd MMM')}`
    case 'month': return format(start, 'MMMM yyyy')
    case 'year': return format(start, 'yyyy')
    // Period birliği yukarıdakilerle tükeniyor; default yalnız TS'in dönüş
    // tipini daraltabilmesi için (computed asla undefined dönmemeli).
    default: return format(start, 'd MMMM yyyy')
  }
})

/**
 * Sayaç kartları — her biri bir ÖNCEKİ aynı aralıkla kıyaslı.
 *
 * 'net' kasıtlı olarak rozetsiz: net işaret değiştirebilir (−5.000 → +3.000) ve
 * orada yüzde saçmalar.
 * DİKKAT — `summary.sum` gerçekte income − expense, yani NET. Eskiden "Bakiye"
 * etiketiyle gösteriliyordu; bakiye elindeki para demek, bu ise dönemin akışı.
 */
const factCards = computed(() => {
  const s = stat.summary
  const p = stat.prevSummary
  return [
    { key: 'income', label: t('trnForm.income'), value: s.income, money: true, tone: 'text-success', delta: changeRatio(s.income, p.income), positiveIsGood: true },
    { key: 'expense', label: t('trnForm.expense'), value: s.expense, money: true, tone: 'text-error', delta: changeRatio(s.expense, p.expense), positiveIsGood: false },
    { key: 'net', label: t('stat.net'), value: s.sum, money: true, tone: s.sum >= 0 ? '' : 'text-error', delta: null, positiveIsGood: true },
    { key: 'count', label: t('wallets.table.trnCount'), value: s.count, money: false, tone: '', delta: changeRatio(s.count, p.count), positiveIsGood: true },
  ]
})

/** İnilen kökün adı — kart başlığı onu gösterir. */
const drillName = computed(() =>
  stat.drillRoot ? categoriesStore.items[stat.drillRoot]?.name ?? '' : '',
)

/**
 * Süzgeç özeti: tek seçimde adı, çoğulda "{n} seçili".
 * Slot'tan gelen `item.title` yerine buradan okunuyor — o slot'un `item`'ı
 * TS'te ham öğe olarak tipleniyor (`{ id, name }`), `.title` yok.
 */
const walletFilterLabel = computed(() => {
  const ids = stat.filterWalletIds
  return ids.length === 1
    ? walletsStore.items?.[ids[0]!]?.name ?? ids[0]!
    : t('walletDetail.nSelected', { n: ids.length })
})
const tagFilterLabel = computed(() => {
  const ids = stat.filterTagIds
  return ids.length === 1
    ? tagsStore.items[ids[0]!]?.name ?? ids[0]!
    : t('walletDetail.nSelected', { n: ids.length })
})
</script>

<template>
  <div class="pa-4">
    <!-- Ana alan + sağ kontrol rayı. Eskiden her şey tek sütunda alt alta
         yığılıydı: periyot, iki süzgeç, aralık gezinme, özet, grafik, kırılım —
         altı blok. Veriyi görmek için üç blok kontrolü kaydırmak gerekiyordu ve
         geniş ekranda sağ yarı boştu. Kontroller artık sabit rayda, veri solda.
         Cüzdan detayındaki "Dönem sağda" düzeniyle aynı kültür. -->
    <div class="d-flex ga-4 align-start stat-layout">
      <div class="flex-1-1 stat-main">
        <!-- Sayaçlar -->
        <div class="d-flex ga-3 mb-4 flex-wrap">
          <KpiCard
            v-for="card in factCards"
            :key="card.key"
            :value="card.value"
            :money="card.money"
            :currency="currenciesStore.base"
            :tone="card.tone"
            :delta="card.delta"
            :positive-is-good="card.positiveIsGood"
            :label="card.label"
            :delta-title="t('stat.vsPrevRange')"
          />
        </div>

        <!-- Seyir grafiği -->
        <SectionCard
          :title="t('stat.trend')"
          :subtitle="t('stat.trendDesc')"
          icon="mdi-chart-bar"
          class="mb-4"
        >
          <StatChart :series="stat.series" :period="stat.period" />
        </SectionCard>

        <!-- Kategori kırılımı -->
        <SectionCard
          :title="stat.drillRoot ? drillName : t('stat.breakdown')"
          :subtitle="stat.drillRoot ? t('stat.breakdownDrillDesc') : t('stat.breakdownDesc')"
          icon="mdi-chart-donut"
          class="mb-4"
        >
          <template #actions>
            <!-- İnildiyse çıkış yolu her zaman görünür: yoksa kullanıcı alt
                 kırılımda kalır ve üst seviyeye dönemez. -->
            <v-btn
              v-if="stat.drillRoot"
              :text="t('stat.allCategories')"
              prepend-icon="mdi-arrow-left"
              variant="text"
              size="small"
              @click="stat.setDrillRoot(null)"
            />
            <!-- Gelir/gider ayrımı kırılımın KENDİ ayarı; sayfanın tepesinde
                 durunca neyi etkilediği belirsizdi. -->
            <v-btn-toggle
              :model-value="stat.statType"
              color="primary"
              mandatory
              density="compact"
              @update:model-value="stat.setStatType($event as StatType)"
            >
              <v-btn value="expense" size="small">
                {{ t('trnForm.expense') }}
              </v-btn>
              <v-btn value="income" size="small">
                {{ t('trnForm.income') }}
              </v-btn>
            </v-btn-toggle>
          </template>

          <div v-if="stat.breakdown.length">
            <div class="d-flex align-center ga-2 mb-3">
              <span class="text-caption text-medium-emphasis">{{ t('wallets.total') }}</span>
              <span class="text-subtitle-2 font-weight-bold">
                {{ fmt.money(stat.breakdownTotal, currenciesStore.base) }}
              </span>
            </div>
            <CategoryBreakdown :items="stat.breakdown" @drill="stat.setDrillRoot($event)" />
          </div>
          <AppEmptyState
            v-else
            density="compact"
            icon="mdi-chart-donut"
            :title="t('stat.noData')"
          />
        </SectionCard>

        <!-- Etiket kırılımı: kategori "ne için", etiket "hangi bağlamda".
             Sayfada etiket SÜZGECİ vardı ama etiket analizi yoktu. -->
        <SectionCard
          v-if="stat.tagBreakdown.length"
          :title="t('stat.byTag')"
          :subtitle="t('stat.byTagDesc')"
          icon="mdi-tag-multiple-outline"
        >
          <div class="stat-tagbars">
            <div v-for="tg in stat.tagBreakdown" :key="tg.tagId" class="stat-tagbar">
              <div class="d-flex align-center ga-2 mb-1">
                <span class="text-caption text-truncate flex-1-1">
                  {{ tg.tagId === '__untagged' ? t('stat.untagged') : (tagsStore.items[tg.tagId]?.name ?? tg.tagId) }}
                </span>
                <span class="text-caption font-weight-medium">
                  {{ fmt.money(tg.amount, currenciesStore.base) }}
                </span>
                <span class="text-caption text-medium-emphasis stat-tagbar-pct">
                  {{ fmt.percent(tg.percent) }}
                </span>
              </div>
              <v-progress-linear
                :model-value="tg.percent"
                :color="tg.tagId === '__untagged' ? 'grey' : (tagsStore.items[tg.tagId]?.color || 'grey')"
                height="6"
              />
            </div>
          </div>
          <!-- Bu not şart: çubukların toplamı %100 etmez ve bu bir hata değil.
               Açıklanmazsa kullanıcı rakamların bozuk olduğunu düşünür. -->
          <div class="text-caption text-medium-emphasis mt-3">
            {{ t('stat.byTagNote') }}
          </div>
        </SectionCard>
      </div>

      <!-- Kontrol rayı -->
      <div class="stat-rail flex-0-0">
        <SectionCard :title="t('walletDetail.period')" icon="mdi-calendar-range" class="mb-4">
          <v-btn-toggle
            :model-value="stat.period"
            color="primary"
            direction="vertical"
            mandatory
            class="w-100 mb-3"
            @update:model-value="stat.setPeriod($event as Period)"
          >
            <v-btn v-for="p in periods" :key="p.value" :value="p.value" class="justify-start">
              {{ p.label }}
            </v-btn>
          </v-btn-toggle>

          <!-- Aralık gezinme periyodun YANINDA: ikisi de aynı soruyu ayarlıyor
               ("hangi aralık"), sayfanın iki ayrı yerinde durmaları kopuktu.
               İleri butonu gelecekte kilitli — offset 0 = güncel aralık. -->
          <div class="d-flex align-center ga-1">
            <v-btn icon="mdi-chevron-left" variant="tonal" size="small" :aria-label="t('common.back')" @click="stat.prev()" />
            <div class="text-body-2 font-weight-medium text-center flex-1-1 text-truncate">
              {{ rangeLabel }}
            </div>
            <v-btn icon="mdi-chevron-right" variant="tonal" size="small" :disabled="stat.offset >= 0" @click="stat.next()" />
          </div>
        </SectionCard>

        <SectionCard :title="t('stat.filters')" icon="mdi-filter-variant">
          <template #actions>
            <v-btn
              v-if="stat.hasFilter"
              :text="t('walletDetail.clearFilters')"
              variant="text"
              size="small"
              @click="stat.clearFilters()"
            />
          </template>

          <!-- chips/closable-chips KALDIRILDI: 36 cüzdanlık bir seçimde çipler
               kartı ekranın dışına taşıyordu. Özet metin sabit yükseklik verir;
               seçim zaten açılır listede işaretli görünüyor. -->
          <v-select
            v-if="walletFilterItems.length"
            :model-value="stat.filterWalletIds"
            :items="walletFilterItems"
            item-title="name"
            item-value="id"
            :label="t('stat.filterWallets')"
            :placeholder="t('walletDetail.filterAll')"
            multiple
            clearable
            hide-details
            class="mb-3"
            @update:model-value="stat.setFilterWalletIds($event)"
          >
            <template #selection="{ index }">
              <span v-if="index === 0" class="text-caption text-truncate">{{ walletFilterLabel }}</span>
            </template>
          </v-select>

          <v-select
            v-if="tagFilterItems.length"
            :model-value="stat.filterTagIds"
            :items="tagFilterItems"
            item-title="name"
            item-value="id"
            :label="t('stat.filterTags')"
            :placeholder="t('walletDetail.filterAll')"
            multiple
            clearable
            hide-details
            @update:model-value="stat.setFilterTagIds($event)"
          >
            <template #selection="{ index }">
              <span v-if="index === 0" class="text-caption text-truncate">{{ tagFilterLabel }}</span>
            </template>
          </v-select>
        </SectionCard>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Ray sabit, ana alan kalanı yer. min-width:0 ŞART — yoksa grafik/uzun metin
   flex öğesini içeriğinden kısaltamaz ve sayfa yatay taşar. */
.stat-main {
  min-width: 0;
}
.stat-rail {
  width: 260px;
}

/* Dar ekranda ray alta iner ve tam genişlik olur: 260px'lik bir sütun telefonda
   ana alana yer bırakmaz. */
@media (max-width: 900px) {
  .stat-layout {
    flex-wrap: wrap;
  }
  .stat-rail {
    width: 100%;
  }
}

/* Sayaçlar dar ekranda ikişerli sarsın; dörde bölünce rakamlar okunmuyordu. */
.stat-tagbars {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px 24px;
}
.stat-tagbar {
  min-width: 0;
}
/* Yüzdeler sağda hizalı: değişken genişlikte olsalar sütun tırtıklı görünür. */
.stat-tagbar-pct {
  min-width: 38px;
  text-align: end;
}
</style>
