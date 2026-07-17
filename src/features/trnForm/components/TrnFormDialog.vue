<script setup lang="ts">
import type { CalculatorKey } from '@/features/trnForm/utils/calculate'

import { useI18n } from 'vue-i18n'
import FormDrawer from '@/components/FormDrawer.vue'
import { useCategoriesStore } from '@/features/categories/store'
import TagFormDialog from '@/features/tags/components/TagFormDialog.vue'
import { useTagsStore } from '@/features/tags/store'
import Calculator from '@/features/trnForm/components/Calculator.vue'
import { useTrnsFormStore } from '@/features/trnForm/store'
import { formatAmountResult, padDisplayCents } from '@/features/trnForm/utils/calculate'
import { useTrnsStore } from '@/features/trns/store'
import { TrnType } from '@/features/trns/types'
import { useWalletsStore } from '@/features/wallets/store'

const { t } = useI18n()
const store = useTrnsFormStore()
const walletsStore = useWalletsStore()
const categoriesStore = useCategoriesStore()
const tagsStore = useTagsStore()
const trnsStore = useTrnsStore()

const showTagForm = ref(false)
const confirmDelete = ref(false)

const isShow = computed({
  get: () => store.ui.isShow,
  set: (v: boolean) => {
    if (!v)
      store.onClose()
  },
})

const isEditing = computed(() => !!store.values.trnId)

const typeItems = computed(() => [
  { value: TrnType.Expense, label: t('trnForm.expense') },
  { value: TrnType.Income, label: t('trnForm.income') },
  { value: TrnType.Transfer, label: t('trnForm.transfer') },
])

// Görüntü: tam sayılar "xxxx,00" olarak, kullanıcı kuruşa dokunmadıkça.
// Doldurma salt görsel — saklanan amountRaw'a girmez (bkz. padDisplayCents).
const activeRaw = computed(() =>
  padDisplayCents(store.values.amountRaw[store.activeAmountIdx] || '0', store.separators),
)

// İpucundaki "= ..." önizlemesi de kuruşlu (matematik sonucu 2 ondalık).
const sumPreview = computed(() =>
  formatAmountResult(store.values.amount[store.activeAmountIdx] ?? 0, store.separators),
)

const walletItems = computed(() =>
  walletsStore.sortedIds.map(id => ({ id, name: walletsStore.items?.[id]?.name ?? id, color: walletsStore.items?.[id]?.color })),
)

const categoryItems = computed(() =>
  categoriesStore.categoriesIdsForTrnValues.map(id => ({
    id,
    name: categoriesStore.items[id]?.name ?? id,
    icon: categoriesStore.items[id]?.icon,
    color: categoriesStore.items[id]?.color,
  })),
)

const tagItems = computed(() =>
  tagsStore.sortedIds.map(id => ({ id, name: tagsStore.items[id]?.name ?? id, color: tagsStore.items[id]?.color })),
)

/**
 * VDateInput Date nesnesiyle çalışır; store ise timestamp tutuyor.
 * Yalnız GÜN değişir: saat/dakika korunur — kullanıcı tarihi düzeltirken
 * işlemin saatini sıfırlamak veri kaybı olurdu.
 */
const dateModel = computed({
  get: () => new Date(store.values.date),
  set: (v: Date | null) => {
    if (!v)
      return
    const dt = new Date(store.values.date)
    dt.setFullYear(v.getFullYear(), v.getMonth(), v.getDate())
    store.values.date = dt.getTime()
  },
})

const isTransfer = computed(() => store.values.trnType === TrnType.Transfer)

/**
 * Başlık şeridi: diğer formlarla (cüzdan/kategori/etiket) aynı dil —
 * ikon + başlık + "ne düzenleniyor" satırı.
 *
 * Cüzdanda tür, kategoride üst kategori, etikette adın kendisi ne ise burada
 * da o: işlemin türü ve hangi kategoriye/cüzdana yazıldığı. Seçim değiştikçe
 * canlı güncellenir — kullanıcı forma dalmışken başlıkta ne kaydedeceğini
 * görür.
 */
const headerIcon = computed(() => {
  if (isTransfer.value)
    return '$transfer'
  return store.values.trnType === TrnType.Income ? '$income' : '$expense'
})

const headerSubtitle = computed(() => {
  const typeLabel = typeItems.value.find(i => i.value === store.values.trnType)?.label ?? ''

  if (isTransfer.value) {
    const from = store.transferExpenseWalletId ? walletsStore.items?.[store.transferExpenseWalletId]?.name : null
    const to = store.transferIncomeWalletId ? walletsStore.items?.[store.transferIncomeWalletId]?.name : null
    return from && to ? `${from} → ${to}` : typeLabel
  }

  const categoryName = store.values.categoryId ? categoriesStore.items?.[store.values.categoryId]?.name : null
  return categoryName ? `${typeLabel} · ${categoryName}` : typeLabel
})

/**
 * Tutar alanı artık gerçek bir input — eskiden <div> idi, o yüzden ne odak
 * alabiliyordu ne de klavyeyi görüyordu; hesap makinesi yalnız fareyle
 * çalışıyordu.
 *
 * Klavye NEDEN doğrudan input'a yazmıyor: tutar düz bir sayı değil, bir İFADE
 * ("1 200 + 35"). Kuralları (basamak sınırı, tek ondalık nokta, operatör
 * değiştirme, binlik ayracı) createExpressionString tutuyor. Tarayıcının kendi
 * yazımına izin verseydik iki ayrı doğruluk kaynağı olurdu ve biçimlendirme
 * imleci sürekli sona atardı. Bu yüzden tuşu yakalayıp AYNI hesap makinesi
 * koduna veriyoruz — klavye ile butonlar birebir aynı yolu izliyor.
 */
const amountField = ref<{ focus: () => void } | null>(null)

function onAmountKey(e: KeyboardEvent) {
  // Kopyala/yapıştır gibi kısayollara dokunma.
  if (e.ctrlKey || e.metaKey || e.altKey)
    return
  // Tab: alanlar arası geçiş — engellenirse klavyeyle formda gezilemez.
  if (e.key === 'Tab')
    return

  e.preventDefault()

  if (e.key === 'Enter') {
    store.submitAndSave()
    return
  }
  if (e.key === 'Backspace' || e.key === 'Delete') {
    store.onClickCalculator('c')
    return
  }

  // Ondalık: kullanıcı ayarındaki ayraç ne ise (nokta ya da virgül) onu kabul
  // et, ama hesap makinesine her zaman kanonik '.' ver. Böylece hem "1,5" hem
  // "1.5" tuşlaması, seçili biçime bakılmaksızın çalışır — ayrık klavyelerde
  // ikisi de denk gelebiliyor.
  const decimalSep = store.separators.decimal
  const key = (e.key === decimalSep || e.key === ',' || e.key === '.') ? '.' : e.key
  if (/^\d$/.test(key) || ['.', '+', '-', '*', '/'].includes(key))
    store.onClickCalculator(key as CalculatorKey)
  // Kalan tuşlar (harfler vb.) yukarıdaki preventDefault ile zaten yutuldu.
}

// Panel açılınca tutara odaklan: form açılır açılmaz klavyeden yazmaya
// başlanabilsin — hesap makinesi için fareye uzanmak gerekmesin.
watch(isShow, async (open) => {
  if (!open)
    return
  await nextTick()
  amountField.value?.focus()
})

function onDelete() {
  const id = store.values.trnId
  if (id)
    trnsStore.deleteTrn(id)
  confirmDelete.value = false
  store.onClose()
}
</script>

<template>
  <!-- Standart form drawer'ı (cüzdan/kategori/etiket ile aynı bileşen). -->
  <FormDrawer
    v-model="isShow"
    :title="isEditing ? t('trnForm.editTitle') : t('trnForm.newTitle')"
    :subtitle="headerSubtitle"
    :icon="headerIcon"
    :deletable="isEditing"
    @save="store.submitAndSave()"
    @delete="confirmDelete = true"
  >
    <!-- Tür seçimi -->
    <v-btn-toggle
      :model-value="store.values.trnType"
      color="primary" mandatory class="w-100"
      @update:model-value="store.onChangeTrnType($event)"
    >
      <v-btn v-for="it in typeItems" :key="it.value" :value="it.value" class="flex-grow-1">
        {{ it.label }}
      </v-btn>
    </v-btn-toggle>

    <!-- Tutar: formun ana alanı.
         Yükseklik `--v-input-control-height` ile — VTextField'ın `height`
         PROP'U YOK (VInput dimension prop'larından yalnız width'i alıyor,
         VInput.js:46), ama Vuetify yüksekliği zaten bu kendi değişkeninden
         okuyor; density'ler de (56/48/40/32px) bunu set ediyor. Yani kendi
         mekanizması, üzerine yazılan bir kural değil. -->
    <v-text-field
      ref="amountField"
      :model-value="activeRaw"
      class="trn-amount"
      style="--v-input-control-height: 72px"
      inputmode="decimal"
      :hint="store.shouldShowSum() ? `= ${sumPreview}` : undefined"
      persistent-hint
      @keydown="onAmountKey"
    />

    <!-- Alan sırası: cüzdan → tarih → kategori → etiket → açıklama.
         Çip duvarı yerine autocomplete: 30+ cüzdan / 70+ kategori çip olarak
         basılınca form ekranlar boyu uzuyor ve seçili olan kayboluyordu.
         Autocomplete tek satır kaplar, yazarak süzmeye de izin verir. -->

    <!-- Transfer: gönderen/alan cüzdanlar -->
    <template v-if="isTransfer">
      <div class="d-flex align-center ga-2">
        <v-autocomplete
          :model-value="store.transferExpenseWalletId"
          :items="walletItems" item-title="name" item-value="id"
          :label="t('trnForm.from')" auto-select-first
          @update:model-value="store.onTransferWalletSelected('expense', $event)"
        />
        <v-btn icon="mdi-swap-horizontal" variant="tonal" @click="store.switchTransferWallets()" />
        <v-autocomplete
          :model-value="store.transferIncomeWalletId"
          :items="walletItems" item-title="name" item-value="id"
          :label="t('trnForm.to')" auto-select-first
          @update:model-value="store.onTransferWalletSelected('income', $event)"
        />
      </div>
      <v-btn-toggle
        v-if="!store.isSameCurrencyTransfer"
        :model-value="store.values.transferType"
        color="primary" mandatory class="w-100"
        @update:model-value="store.onChangeTransferType($event)"
      >
        <v-btn value="expense" class="flex-grow-1">
          {{ t('trnForm.from') }}
        </v-btn>
        <v-btn value="income" class="flex-grow-1">
          {{ t('trnForm.to') }}
        </v-btn>
      </v-btn-toggle>
    </template>

    <!-- Gelir/Gider: cüzdan -->
    <template v-else>
      <div v-if="!walletItems.length" class="text-medium-emphasis">
        {{ t('trnForm.noWallets') }}
      </div>
      <v-autocomplete
        v-else
        v-model="store.values.walletId"
        :items="walletItems" item-title="name" item-value="id"
        :label="t('trnForm.wallet')" auto-select-first
      >
        <template #prepend-inner>
          <v-icon icon="mdi-wallet-outline" :color="walletsStore.items?.[store.values.walletId ?? '']?.color" size="20" />
        </template>
        <!-- Vuetify 4: slot'un `item`'ı artık HAM öğedir (v3'teki ListItem değil);
             ListItem `internalItem` olarak ayrı geçer. Bu yüzden `.raw` yok. -->
        <template #item="{ props: itemProps, item }">
          <v-list-item v-bind="itemProps" :title="item.name">
            <template #prepend>
              <v-icon icon="mdi-wallet-outline" :color="item.color" size="20" />
            </template>
          </v-list-item>
        </template>
      </v-autocomplete>
    </template>

    <!-- Tarih. Tarayıcının type="date" alanı yerine Vuetify tarih seçici:
         biçim ve takvim uygulamanın diline/temasına uyar (tarayıcı alanı
         işletim sistemine uyuyordu). Takvim ikonu içeride — defaults.ts. -->
    <v-date-input v-model="dateModel" :label="t('trnForm.date')" />

    <!-- Kategori (transfer'de yok: kategori 'transfer' olarak sabitleniyor) -->
    <template v-if="!isTransfer">
      <div v-if="!categoryItems.length" class="text-medium-emphasis">
        {{ t('trnForm.noCategories') }}
      </div>
      <v-autocomplete
        v-else
        v-model="store.values.categoryId"
        :items="categoryItems" item-title="name" item-value="id"
        :label="t('trnForm.category')" auto-select-first
      >
        <template #prepend-inner>
          <v-icon
            :icon="categoriesStore.items?.[store.values.categoryId ?? '']?.icon ?? '$navCategories'"
            :color="categoriesStore.items?.[store.values.categoryId ?? '']?.color"
            size="20"
          />
        </template>
        <template #item="{ props: itemProps, item }">
          <v-list-item v-bind="itemProps" :title="item.name">
            <template #prepend>
              <v-icon :icon="item.icon" :color="item.color" size="20" />
            </template>
          </v-list-item>
        </template>
      </v-autocomplete>
    </template>

    <!-- Etiketler (tags): çoklu seçim + yanında satır içi yeni etiket butonu -->
    <v-autocomplete
      v-model="store.values.tagIds"
      :items="tagItems" item-title="name" item-value="id"
      :label="t('tags.title')" prepend-inner-icon="$navTags"
      multiple chips closable-chips auto-select-first
    >
      <template #chip="{ props: chipProps, item }">
        <v-chip v-bind="chipProps" :color="item.color" size="small" :text="item.name" />
      </template>
      <template #item="{ props: itemProps, item }">
        <v-list-item v-bind="itemProps" :title="item.name">
          <template #prepend="{ isSelected }">
            <v-icon :icon="isSelected ? 'mdi-check-circle' : 'mdi-circle-outline'" :color="item.color" size="20" />
          </template>
        </v-list-item>
      </template>
      <!-- "Yeni etiket" alanın İÇİNDE, açılır ok ikonunun yanında.
           mousedown.stop ŞART: alanın içine yapılan basış autocomplete'i
           odaklayıp menüyü açıyor — durdurulmazsa etiket paneli, arkasında
           açık kalmış bir açılır listeyle birlikte geliyor. click.stop ise
           basışın seçim mantığına düşmesini engelliyor. -->
      <template #append-inner>
        <v-btn
          icon="mdi-plus"
          variant="text"
          density="comfortable"
          size="small"
          :aria-label="t('tags.add')"
          @mousedown.stop
          @click.stop="showTagForm = true"
        />
      </template>
    </v-autocomplete>

    <!-- Açıklama: textarea — açıklamalar tek satıra sığmıyor, uzun metin
         text-field'da soldan kayıp görünmez oluyordu. auto-grow: kısa
         açıklamada yer kaplamaz, uzadıkça büyür. -->
    <v-textarea
      v-model="store.values.desc"
      :label="t('trnForm.description')"
      prepend-inner-icon="mdi-text"
      rows="2" auto-grow
    />

    <!-- Hesap makinesi -->
    <Calculator @key="store.onClickCalculator($event)" />
  </FormDrawer>

  <!-- Satır içi yeni etiket oluşturma (kardeş panel) -->
  <TagFormDialog v-model="showTagForm" :tag-id="null" @created="store.toggleTag($event)" />

  <!-- Silme onayı (düzenleme modunda) -->
  <v-dialog v-model="confirmDelete" max-width="360">
    <v-card>
      <v-card-text>{{ t('trns.deleteConfirm') }}</v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="confirmDelete = false">
          {{ t('common.cancel') }}
        </v-btn>
        <v-btn color="error" variant="flat" @click="onDelete">
          {{ t('common.delete') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
/* Tutar input'unun İÇ metni. Bu üç şey için Vuetify'da prop YOK ve utility
   class da İŞE YARAMIYOR — ölçüldü: kök öğeye `text-center text-h4` verince
   input'ta text-align hâlâ `start`, font-size hâlâ 16px çıkıyor (Vuetify'ın
   kendi .v-field__input kuralları kazanıyor). Bu yüzden :deep ile input'un
   kendisi hedefleniyor.
   Yükseklik burada DEĞİL: onu Vuetify'ın kendi --v-input-control-height
   değişkeni veriyor (template'te), CSS'le ezilmiyor. */
.trn-amount :deep(input) {
  text-align: center;
  font-size: 2.125rem; /* text-h4 ölçeğiyle aynı */
  font-weight: 700;
}

/* Hesaplanan sonuç ("= 1235") tutarın altında, ortada. */
.trn-amount :deep(.v-messages) {
  text-align: center;
}
</style>
