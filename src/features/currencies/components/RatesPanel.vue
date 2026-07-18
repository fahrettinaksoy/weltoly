<script setup lang="ts">
import type { RateSourceKey } from '@/features/currencies/sources'

import { useI18n } from 'vue-i18n'
import SectionCard from '@/components/SectionCard.vue'
import { rateFreshness } from '@/features/currencies/freshness'
import { RATE_SOURCE_KEYS, RATE_SOURCES } from '@/features/currencies/sources'
import { useCurrenciesStore } from '@/features/currencies/store'
import { useUserStore } from '@/features/user/store'
import { refreshRates } from '@/services/rates'
import { showErrorToast, showSuccessToast } from '@/stores/ui'

/**
 * Kur kaynağı seçimi + güncellik ekranı.
 *
 * NEDEN AYRI EKRAN: kur seti sessizce eskiyebilen bir veri. Kaynak tek seferlik
 * bir hatayla düşerse (429/timeout) toplamlar eski kurla hesaplanmaya devam eder
 * ve hiçbir yerde görünmez — gerçek veride kripto kurları 2 gün boyunca böyle
 * eksik kaldı ve net varlık 5 kat düşük göründü. Bu ekran üç soruyu yanıtlar:
 * hangi kaynaktan, ne zamanın kuru, en son ne zaman çekildi.
 */
const { t } = useI18n()
const userStore = useUserStore()
const currenciesStore = useCurrenciesStore()
const fmt = useFormat()

const busy = ref(false)

const sourceOptions = computed(() =>
  RATE_SOURCE_KEYS.map((k) => ({
    value: k,
    title: RATE_SOURCES[k].label,
    subtitle: t(RATE_SOURCES[k].descKey)
  }))
)

const meta = computed(() => currenciesStore.meta)

/**
 * Güncellik kararı saf mantıkta (freshness.ts, testli): hafta sonu "dünkü kur"
 * NORMALDİR, iş günü sayılır. Burada yalnız sunum var.
 */
const freshness = computed(() => rateFreshness(meta.value?.rateDate ?? null))

const freshnessMeta = computed(() => {
  switch (freshness.value.level) {
    case 'fresh':
      return {
        color: 'success',
        icon: 'mdi-check-circle-outline',
        label: t('settings.ratesFresh'),
        hint: t('settings.ratesFreshHint')
      }
    case 'stale':
      return {
        color: 'warning',
        icon: 'mdi-alert-outline',
        label: t('settings.ratesStale'),
        hint: t('settings.ratesStaleHint', { n: freshness.value.ageDays ?? 0 })
      }
    default:
      return {
        color: 'grey',
        icon: 'mdi-help-circle-outline',
        label: t('settings.ratesUnknown'),
        hint: t('settings.ratesUnknownHint')
      }
  }
})

/** Kayıtlı kur setinin künye satırları. */
const statusRows = computed(() => {
  const m = meta.value
  if (!m) return []
  return [
    { key: 'source', label: t('settings.ratesSource'), value: m.source ?? '—' },
    {
      key: 'rateDate',
      label: t('settings.ratesRateDate'),
      value: m.rateDate ? fmt.date(new Date(m.rateDate)) : '—'
    },
    {
      key: 'fetchedAt',
      label: t('settings.ratesFetchedAt'),
      value: m.updatedAt ? fmt.date(m.updatedAt) : '—'
    },
    {
      key: 'count',
      label: t('settings.ratesCount'),
      value: fmt.number(Object.keys(currenciesStore.rates).length)
    }
  ]
})

async function onChangeSource(v: unknown) {
  await userStore.saveRateSource(v as RateSourceKey)
  // Kaynak değişti → mevcut set artık başka bir kaynaktan; hemen yenile ki
  // ekrandaki künye ile gerçek uyuşsun.
  await onRefresh()
}

async function onRefresh() {
  busy.value = true
  try {
    // Sonucu refreshRates'in KENDİSİ söyler. Eskiden başarı "store'daki
    // updatedAt değişti mi" diye anlaşılmaya çalışılıyordu; store watchTable
    // üzerinden 30ms throttle ile asenkron dolduğu için `nextTick` yetmiyor ve
    // BAŞARILI çekimde bile "çekilemedi" basılıyordu.
    const r = await refreshRates(true) // force: kullanıcı açıkça istedi
    if (r === 'error') showErrorToast('settings.ratesRefreshFailed')
    else showSuccessToast('settings.ratesRefreshed') // 'ok' | 'skipped'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <SectionCard
    :title="t('settings.rateSource')"
    :subtitle="t('settings.rateSourceHint')"
    icon="mdi-swap-horizontal-bold"
    class="mb-4"
  >
    <v-select
      :model-value="userStore.rateSource"
      :items="sourceOptions"
      item-title="title"
      item-value="value"
      hide-details
      @update:model-value="onChangeSource"
    >
      <!-- Açıklama şart: kaynaklar kapsam ve resmiyet olarak farklı; ad tek
           başına "hangisini seçmeliyim" sorusunu yanıtlamıyor.
           Vuetify 4: slot'un `item`'ı HAM öğedir (`.raw` yok, o v3 idi). -->
      <template #item="{ props: itemProps, item }">
        <v-list-item v-bind="itemProps" :subtitle="item.subtitle" />
      </template>
    </v-select>
  </SectionCard>

  <SectionCard
    :title="t('settings.ratesStatus')"
    :subtitle="t('settings.ratesStatusDesc')"
    icon="mdi-clock-check-outline"
  >
    <template #actions>
      <v-btn
        variant="tonal"
        size="small"
        prepend-icon="mdi-refresh"
        :loading="busy"
        @click="onRefresh"
      >
        {{ t('settings.ratesRefresh') }}
      </v-btn>
    </template>

    <!-- Hiç kur yok: dürüst boş durum, uydurma künye değil. -->
    <div v-if="!meta" class="text-body-2 text-medium-emphasis">
      {{ t('settings.ratesNever') }}
    </div>

    <template v-else>
      <div class="d-flex align-center ga-2 mb-4">
        <v-chip
          :color="freshnessMeta.color"
          :prepend-icon="freshnessMeta.icon"
          size="small"
          variant="flat"
        >
          {{ freshnessMeta.label }}
        </v-chip>
        <span class="text-caption text-medium-emphasis">{{ freshnessMeta.hint }}</span>
      </div>

      <div class="rates-status">
        <div v-for="row in statusRows" :key="row.key" class="rates-status-cell">
          <div class="text-caption text-medium-emphasis">
            {{ row.label }}
          </div>
          <div class="text-body-2 font-weight-medium text-truncate" :title="row.value">
            {{ row.value }}
          </div>
        </div>
      </div>
    </template>
  </SectionCard>
</template>

<style scoped>
/* Künye hücreleri: dar ekranda alta iner, sıkışıp okunmaz olmaz. */
.rates-status {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.rates-status-cell {
  flex: 1 1 0;
  min-width: 140px;
}
</style>
