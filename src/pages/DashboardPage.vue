<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { endOfMonth, startOfMonth, subMonths } from 'date-fns'

import { useWalletsStore } from '@/features/wallets/store'
import { useTrnsStore } from '@/features/trns/store'
import { useCurrenciesStore } from '@/features/currencies/store'
import { useCategoriesStore } from '@/features/categories/store'
import { useTagsStore } from '@/features/tags/store'
import { useUserStore } from '@/features/user/store'
import { walletTypes } from '@/features/wallets/types'
import { walletTypeIcon } from '@/features/wallets/walletMeta'
import { TrnType } from '@/features/trns/types'
import { useFormat } from '@/composables/useFormat'
import SectionCard from '@/components/SectionCard.vue'
import AppEmptyState from '@/components/AppEmptyState.vue'
import TrnList from '@/features/trns/components/TrnList.vue'

const { t } = useI18n()
const walletsStore = useWalletsStore()
const trnsStore = useTrnsStore()
const currenciesStore = useCurrenciesStore()
const categoriesStore = useCategoriesStore()
const tagsStore = useTagsStore()
const userStore = useUserStore()
const fmt = useFormat()

const base = computed(() => currenciesStore.base)

// --- Varlık / borç -------------------------------------------------------
/**
 * Başlık artık NET VARLIK, yanında varlık ve borç ayrı.
 *
 * Eskiden tek bir "Toplam bakiye" vardı ve borçlar dahil tüm cüzdanları tek
 * toplamda eritiyordu. Ölçüldü: örnek veride −223.138 gösteriyordu, oysa 320.174
 * varlık var ve borcun %77'si konut kredisi. Açılış ekranı kullanıcıyı kocaman
 * bir eksiyle karşılayıp varlığını gizliyordu. Üstelik "bakiye" yanlış kelime:
 * bakiye elindeki para, bu ise varlık eksi borç.
 * Rakam artık walletsStore.totals'tan — Cüzdanlar sayfasıyla tek kaynak.
 */
const totals = computed(() => walletsStore.totals)

// --- Bu ay ---------------------------------------------------------------
/**
 * Karşılaştırma TAKVİM AYIYLA: aylar eşit uzunlukta değil, 30 gün geriye gitmek
 * Şubat'ta yanlış pencere verirdi.
 */
const thisMonth = computed(() => ({ from: startOfMonth(Date.now()).getTime(), to: endOfMonth(Date.now()).getTime() }))
const lastMonth = computed(() => {
  const d = subMonths(Date.now(), 1)
  return { from: startOfMonth(d).getTime(), to: endOfMonth(d).getTime() }
})

/**
 * Bir aralığın gelir/gider/adedi — temel para biriminde.
 * Transfer ve düzeltme HARİÇ (finapp kuralı): transfer para kazanmak değil,
 * düzeltme gerçek bir hareket değil. Uygulamanın her yerindeki tanımla aynı.
 */
function flowIn(range: { from: number, to: number }) {
  let income = 0
  let expense = 0
  let count = 0
  for (const id of trnsStore.getStoreTrnsIds({ sort: false })) {
    const trn = trnsStore.items?.[id]
    if (!trn || trn.date < range.from || trn.date > range.to)
      continue
    if (trn.type === TrnType.Transfer || trn.categoryId === 'adjustment')
      continue
    const wallet = walletsStore.itemsComputed[trn.walletId]
    const amount = trn.amount * (wallet?.rate ?? 1)
    count++
    if (trn.type === TrnType.Income)
      income += amount
    else expense += amount
  }
  return { income, expense, net: income - expense, count }
}

const monthFlow = computed(() => flowIn(thisMonth.value))
const prevMonthFlow = computed(() => flowIn(lastMonth.value))

/** Önceki ay 0 ise yüzde TANIMSIZDIR (0'a bölme) → rozet gösterilmez. */
function changeRatio(current: number, previous: number): number | null {
  if (previous === 0)
    return null
  return ((current - previous) / Math.abs(previous)) * 100
}

/** Gider artışı KÖTÜ, gelir artışı İYİ — yön tek başına renk belirlemez. */
function deltaTone(delta: number, positiveIsGood: boolean): string | undefined {
  if (Math.abs(delta) < 1)
    return undefined
  return (delta > 0) === positiveIsGood ? 'success' : 'error'
}

const monthCards = computed(() => {
  const c = monthFlow.value
  const p = prevMonthFlow.value
  return [
    { key: 'income', label: t('trnForm.income'), value: c.income, money: true, tone: 'text-success', delta: changeRatio(c.income, p.income), positiveIsGood: true },
    { key: 'expense', label: t('trnForm.expense'), value: c.expense, money: true, tone: 'text-error', delta: changeRatio(c.expense, p.expense), positiveIsGood: false },
    { key: 'net', label: t('stat.net'), value: c.net, money: true, tone: c.net >= 0 ? '' : 'text-error', delta: null, positiveIsGood: true },
    { key: 'count', label: t('wallets.table.trnCount'), value: c.count, money: false, tone: '', delta: changeRatio(c.count, p.count), positiveIsGood: true },
  ]
})

// --- Para nerede duruyor -------------------------------------------------
/**
 * Varlığın cüzdan TÜRÜNE göre dağılımı — "paranın ne kadarı nakit, ne kadarı
 * kripto". Cüzdanlar sayfasındaki pasta cüzdan BAŞINA; 36 cüzdanda o soruyu
 * yanıtlamıyor.
 *
 * Yalnız POZİTİF bakiyeler: borç cüzdanları karışırsa "nerede duruyor" sorusu
 * anlamını yitirir — borç bir yerde durmuyor.
 */
const assetsByType = computed(() => {
  const sums = new Map<string, number>()
  for (const wallet of Object.values(walletsStore.itemsComputed)) {
    if (wallet.isExcludeInTotal)
      continue
    const value = wallet.amount * (wallet.rate ?? 1)
    if (value <= 0)
      continue
    sums.set(wallet.type, (sums.get(wallet.type) ?? 0) + value)
  }
  const total = totals.value.assets
  return walletTypes
    .filter(type => sums.has(type))
    .map(type => ({
      key: type,
      title: t(`wallets.types.${type}`),
      // Satır bir cüzdanı değil TÜRÜ temsil ediyor → türün ikonu.
      icon: walletTypeIcon[type],
      value: sums.get(type)!,
      percent: total ? (sums.get(type)! / total) * 100 : 0,
    }))
    .toSorted((a, b) => b.value - a.value)
})

// --- Kredi kartı riski ---------------------------------------------------
/**
 * Kartların toplam limiti / kullanımı. Hiçbir sayfada yoktu: cüzdan detayında
 * tek kartın limiti var, ama "toplamda ne kadar borçluyum, limitin ne kadarı
 * doldu" sorusu yanıtsızdı.
 *
 * Kart bakiyesi NEGATİFTİR (borç); kullanılan = mutlak değeri. Bakiye pozitifse
 * (fazla ödeme) kullanım 0 sayılır — negatif kullanım anlamsız.
 * Arşivli kartlar hariç: kapatılmış kartın limiti risk değil.
 */
const creditCards = computed(() =>
  Object.entries(walletsStore.itemsComputed)
    .filter(([, w]) => w.type === 'credit' && !w.isArchived)
    .map(([id, w]) => {
      const limit = ('creditLimit' in w ? w.creditLimit : 0) ?? 0
      const used = Math.max(0, -w.amount)
      return {
        id,
        name: w.name,
        color: w.color,
        currency: w.currency,
        used,
        ratio: limit > 0 ? Math.min(100, (used / limit) * 100) : 0,
      }
    })
    .toSorted((a, b) => b.ratio - a.ratio),
)

/** Toplam limit/kullanım TEMEL para biriminde — kartlar farklı birimde olabilir
    (Amex USD), ham toplamak elmayla armudu toplamak olurdu. */
const creditTotal = computed(() => {
  let limit = 0
  let used = 0
  for (const card of Object.values(walletsStore.itemsComputed)) {
    if (card.type !== 'credit' || card.isArchived)
      continue
    const rate = card.rate ?? 1
    limit += (('creditLimit' in card ? card.creditLimit : 0) ?? 0) * rate
    used += Math.max(0, -card.amount) * rate
  }
  return { limit, used, ratio: limit > 0 ? Math.min(100, (used / limit) * 100) : 0 }
})

/** Doluluk rengi: %80 üstü kırmızı, %50 üstü sarı. Cüzdan detayıyla aynı eşik. */
function usageTone(ratio: number) {
  return ratio > 80 ? 'error' : ratio > 50 ? 'warning' : 'success'
}

// --- Proje durumu --------------------------------------------------------
/**
 * Verinin kendisi hakkındaki bakış — "tüm projeye ait" kısım. Diğer kartlar
 * paranın hikâyesini anlatıyor; burası defterin durumunu.
 */
const allTrnIds = computed(() => trnsStore.getStoreTrnsIds({ sort: true }))

const projectStats = computed(() => {
  const usedCategories = new Set<string>()
  const usedTags = new Set<string>()
  for (const id of allTrnIds.value) {
    const trn = trnsStore.items?.[id]
    if (!trn)
      continue
    usedCategories.add(trn.categoryId)
    for (const tid of trn.tagIds ?? [])
      usedTags.add(tid)
  }
  // Sentetik kategoriler sayılmaz: kullanıcının oluşturduğu bir şey değiller.
  const catIds = Object.keys(categoriesStore.items ?? {}).filter(id => id !== 'transfer' && id !== 'adjustment')
  return [
    { key: 'wallets', icon: 'mdi-wallet-outline', label: t('nav.wallets'), value: walletsStore.sortedIds.length, hint: undefined as string | undefined, to: '/wallets' as string | undefined },
    { key: 'trns', icon: 'mdi-swap-horizontal', label: t('walletDetail.transactions'), value: allTrnIds.value.length, hint: undefined, to: undefined },
    {
      key: 'categories',
      icon: 'mdi-shape-outline',
      label: t('nav.categories'),
      value: catIds.length,
      // Kullanılmayan sayısı: taksonomi büyüdükçe ölü kategori birikir ve hiçbir
      // yerde görünmez.
      hint: t('dashboard.unusedN', { n: catIds.filter(id => !usedCategories.has(id)).length }),
      to: '/categories',
    },
    {
      key: 'tags',
      icon: 'mdi-tag-outline',
      label: t('nav.tags'),
      value: tagsStore.sortedIds.length,
      hint: t('dashboard.unusedN', { n: tagsStore.sortedIds.filter(id => !usedTags.has(id)).length }),
      to: '/tags',
    },
  ]
})

/** Defterin kapsadığı zaman aralığı — "ne kadar geçmişim var". */
const trnSpan = computed(() => {
  const ids = allTrnIds.value
  if (!ids.length)
    return null
  // getStoreTrnsIds sort:true → en yeni başta, en eski sonda.
  const last = trnsStore.items?.[ids[0]!]
  const first = trnsStore.items?.[ids.at(-1)!]
  return first && last ? { first: first.date, last: last.date } : null
})

const defaultWallet = computed(() => {
  const id = userStore.defaultWalletId
  return id ? walletsStore.itemsComputed[id] ?? null : null
})

// --- Son işlemler --------------------------------------------------------
/** Seçimi v-slide-group'un grup modeli yönetiyor (multiple + v-model); elle
    toggle yazmaya gerek yok. */
const filterTagIds = ref<string[]>([])

/** Kaç GÜN gösterilecek. Kesme TrnList'te gün bazında yapılıyor. */
const RECENT_DAYS = 5

/**
 * Kesme burada YOK — eskiden `.slice(0, 50)` vardı ve artık zararlı olurdu:
 * liste gün gün gösteriliyor, işlem bazlı kırpma son günü ortasından bölerdi
 * (o günün bir kısmı görünür, gerisi sessizce kaybolurdu). Sınırı gün olarak
 * TrnList uyguluyor.
 */
const recentIds = computed(() =>
  trnsStore.getStoreTrnsIds({
    sort: true,
    tagsIds: filterTagIds.value.length ? filterTagIds.value : undefined,
  }),
)
</script>

<template>
  <div class="pa-4">
    <!-- Net varlık şeridi: tek rakam yerine üçlü. Net tek başına dengeyi gizler. -->
    <v-sheet color="primary" class="pa-5 mb-4 dash-hero">
      <div class="d-flex align-center ga-6 flex-wrap">
        <div class="dash-hero-main">
          <div class="text-caption dash-hero-label">{{ t('dashboard.netWorth') }}</div>
          <div class="text-h4 font-weight-bold">{{ fmt.money(totals.net, base) }}</div>
        </div>
        <div class="dash-hero-cell">
          <div class="text-caption dash-hero-label">{{ t('wallets.stats.assets') }}</div>
          <div class="text-subtitle-1 font-weight-medium">{{ fmt.money(totals.assets, base) }}</div>
        </div>
        <div class="dash-hero-cell">
          <div class="text-caption dash-hero-label">{{ t('wallets.stats.debts') }}</div>
          <div class="text-subtitle-1 font-weight-medium">{{ fmt.money(totals.debts, base) }}</div>
        </div>
        <div class="dash-hero-cell">
          <div class="text-caption dash-hero-label">{{ t('wallets.stats.debtRatio') }}</div>
          <div class="text-subtitle-1 font-weight-medium">%{{ fmt.number(Math.round(walletsStore.debtRatio)) }}</div>
        </div>
        <div v-if="defaultWallet" class="dash-hero-cell dash-hero-wallet">
          <div class="text-caption dash-hero-label">{{ t('wallets.default') }}</div>
          <div class="text-subtitle-1 font-weight-medium text-truncate">{{ defaultWallet.name }}</div>
        </div>
      </div>
    </v-sheet>

    <!-- Bu ay -->
    <div class="d-flex ga-3 mb-4 flex-wrap">
      <v-sheet
        v-for="card in monthCards"
        :key="card.key"
        color="surface-light"
        class="pa-4 flex-1-1 dash-kpi"
      >
        <div class="d-flex align-center ga-2">
          <div class="text-h5 font-weight-bold text-truncate" :class="card.tone">
            {{ card.money ? fmt.money(card.value, base) : fmt.number(card.value) }}
          </div>
          <v-chip
            v-if="card.delta !== null"
            :color="deltaTone(card.delta, card.positiveIsGood)"
            :prepend-icon="card.delta >= 0 ? 'mdi-arrow-up' : 'mdi-arrow-down'"
            size="x-small"
            variant="tonal"
            :title="t('dashboard.vsPrevMonth')"
          >
            %{{ fmt.number(Math.abs(Math.round(card.delta))) }}
          </v-chip>
        </div>
        <div class="text-caption text-medium-emphasis">
          {{ t('dashboard.thisMonth') }} · {{ card.label }}
        </div>
      </v-sheet>
    </div>

    <div class="d-flex ga-4 align-stretch flex-wrap mb-4">
      <!-- Para nerede duruyor -->
      <SectionCard
        v-if="assetsByType.length"
        :title="t('dashboard.whereIsMoney')"
        :subtitle="t('dashboard.whereIsMoneyDesc')"
        icon="mdi-safe"
        class="flex-1-1 dash-col"
      >
        <div v-for="row in assetsByType" :key="row.key" class="mb-3">
          <div class="d-flex align-center ga-2 mb-1">
            <v-icon :icon="row.icon" size="18" class="text-medium-emphasis" />
            <span class="text-body-2 text-truncate flex-1-1">{{ row.title }}</span>
            <span class="text-body-2 font-weight-medium">{{ fmt.money(row.value, base) }}</span>
            <span class="text-caption text-medium-emphasis dash-pct">%{{ fmt.number(Math.round(row.percent)) }}</span>
          </div>
          <v-progress-linear :model-value="row.percent" color="primary" height="6" />
        </div>
      </SectionCard>

      <!-- Kredi kartı riski -->
      <SectionCard
        v-if="creditCards.length"
        :title="t('dashboard.creditRisk')"
        :subtitle="t('dashboard.creditRiskDesc')"
        icon="mdi-credit-card-outline"
        class="flex-1-1 dash-col"
      >
        <!-- Önce toplam: tek tek kartlara bakmadan "ne durumdayım" cevabı. -->
        <div class="mb-4">
          <div class="d-flex align-center ga-2 mb-1">
            <span class="text-body-2 flex-1-1">{{ t('wallets.total') }}</span>
            <span class="text-body-2 font-weight-medium">
              {{ fmt.money(creditTotal.used, base) }} / {{ fmt.money(creditTotal.limit, base) }}
            </span>
          </div>
          <v-progress-linear :model-value="creditTotal.ratio" :color="usageTone(creditTotal.ratio)" height="10" />
        </div>

        <div v-for="card in creditCards" :key="card.id" class="mb-3">
          <div class="d-flex align-center ga-2 mb-1">
            <v-avatar :color="card.color" size="10" />
            <span class="text-caption text-truncate flex-1-1">{{ card.name }}</span>
            <span class="text-caption text-medium-emphasis">{{ fmt.money(card.used, card.currency) }}</span>
            <span class="text-caption text-medium-emphasis dash-pct">%{{ fmt.number(Math.round(card.ratio)) }}</span>
          </div>
          <v-progress-linear :model-value="card.ratio" :color="usageTone(card.ratio)" height="6" />
        </div>
      </SectionCard>
    </div>

    <!-- align-stretch: iki kart AYNI boyda. Boyu "Defter durumu" belirler —
         Son işlemler'in listesi mutlak konumlu olduğu için yüksekliğe katılmıyor
         (aşağıdaki CSS). align-start olsaydı her kart kendi boyunda kalırdı. -->
    <div class="d-flex ga-4 align-stretch flex-wrap">
      <!-- Son işlemler -->
      <SectionCard
        :title="t('dashboard.recentTrns')"
        :subtitle="t('dashboard.recentTrnsDesc', { n: RECENT_DAYS })"
        icon="mdi-history"
        class="dash-recent"
      >
        <template #actions>
          <v-btn
            v-if="filterTagIds.length"
            :text="t('walletDetail.clearFilters')"
            variant="text"
            size="small"
            @click="filterTagIds = []"
          />
        </template>

        <!-- Etiketler tek satırda kayar: 20 etiket sarınca üç sıra oluyor ve
             kartın tepesini yiyordu. Seçimi slide-group'un kendi grup modeli
             taşıyor (multiple + v-model) — ayrı bir toggle fonksiyonu gerekmiyor. -->
        <v-slide-group v-if="tagsStore.hasItems" v-model="filterTagIds" multiple show-arrows class="mb-3">
          <v-slide-group-item
            v-for="id in tagsStore.sortedIds"
            :key="id"
            v-slot="{ isSelected, toggle }"
            :value="id"
          >
            <v-chip
              :color="tagsStore.items[id]?.color"
              :variant="isSelected ? 'flat' : 'outlined'"
              size="small"
              class="me-2"
              @click="toggle"
            >
              <v-icon v-if="isSelected" icon="mdi-check" start size="14" />
              {{ tagsStore.items[id]?.name }}
            </v-chip>
          </v-slide-group-item>
        </v-slide-group>

        <!-- Liste kendi içinde kayar; etiketler ve başlık sabit kalır. Kaydırma
             TrnList'in içinde değil burada: yükseklik kartın düzen kararı,
             bileşenin değil.
             İki katman şart — dıştaki ölçüyü alır, içteki mutlak konumla ondan
             KOPAR (aşağıdaki CSS): yoksa liste açıldıkça kartı büyütür ve
             yanındaki "Defter durumu" onunla birlikte uzardı. -->
        <div v-if="recentIds.length" class="dash-recent-list">
          <div class="dash-recent-scroll">
            <TrnList :ids="recentIds" :max-groups="RECENT_DAYS" />
          </div>
        </div>
        <!-- Boş durum süzgeci ayırt eder: "işlem yok" ile "süzgece uyan yok"
             farklı sorunlar; ikincisinde kullanıcı çıkışı yukarıdaki butonda. -->
        <AppEmptyState
          v-else
          density="compact"
          icon="mdi-note-plus-outline"
          :title="filterTagIds.length ? t('walletDetail.noFilterMatch') : t('dashboard.noTrns')"
        />
      </SectionCard>

      <!-- Proje durumu: diğer kartlar paranın hikâyesini anlatıyor, bu defterin
           durumunu — kaç kayıt var, ne kadar geçmiş var, ne ölü duruyor. -->
      <SectionCard
        :title="t('dashboard.projectState')"
        :subtitle="t('dashboard.projectStateDesc')"
        icon="mdi-database-outline"
        class="dash-side"
      >
        <v-list density="comfortable" bg-color="transparent" class="pa-0">
          <v-list-item
            v-for="s in projectStats"
            :key="s.key"
            :to="s.to"
            :prepend-icon="s.icon"
            :title="s.label"
            :subtitle="s.hint"
            class="px-2"
          >
            <template #append>
              <span class="text-subtitle-2 font-weight-bold">{{ fmt.number(s.value) }}</span>
            </template>
          </v-list-item>
        </v-list>

        <v-divider class="my-3" />

        <div v-if="trnSpan" class="px-2 mb-3">
          <div class="text-caption text-medium-emphasis">{{ t('dashboard.trnSpan') }}</div>
          <div class="text-body-2">{{ fmt.date(trnSpan.first) }} – {{ fmt.date(trnSpan.last) }}</div>
        </div>
        <div class="px-2">
          <div class="text-caption text-medium-emphasis">{{ t('settings.currency') }}</div>
          <div class="text-body-2">{{ base }}</div>
        </div>
      </SectionCard>
    </div>
  </div>
</template>

<style scoped>
/* Şerit primary zeminde: metin kontrastı on-primary'den gelmeli, yoksa açık
   temada okunmaz (v-sheet color= sadece zemini verir). */
.dash-hero {
  color: rgb(var(--v-theme-on-primary));
}
.dash-hero-label {
  opacity: 0.8;
}
/* Ana rakam geniş kalsın, yan hücreler içerikleri kadar yer alsın.
   min-width:0 şart — yoksa uzun cüzdan adı flex öğesini taşırır. */
.dash-hero-main {
  min-width: 0;
  flex: 1 1 220px;
}
.dash-hero-cell {
  min-width: 0;
  flex: 0 1 auto;
}
.dash-hero-wallet {
  max-width: 200px;
}

/* Dörde bölününce rakamlar okunmuyordu; dar ekranda ikişerli sarsın. */
.dash-kpi {
  min-width: 150px;
}

/* İki kart yan yana; min-width kırılma noktasını verir, altında alt alta iner. */
.dash-col {
  min-width: 280px;
}

/* Son işlemler geniş, proje durumu dar sütun. min-width:0 şart: liste içeriği
   flex öğesini kısaltamazsa sayfa yatay taşar.
   Kart bir flex sütun: başlık şeridi sabit, gövde kalanı alır. */
.dash-recent {
  flex: 3 1 380px;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
/* Gövde kartın kalan boyunu alsın. min-height:0 ŞART — flex öğesi varsayılan
   olarak içeriğinin altına inemez, o zaman kaydırma hiç oluşmaz. */
.dash-recent :deep(.v-card-text) {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/*
 * Yükseklik zincirinin kilit noktası.
 *
 * Hedef: kartın boyunu "Defter durumu" belirlesin. Bunun için Son işlemler
 * listesinin yüksekliğe KATILMAMASI gerekiyor — yoksa satır `align-stretch`
 * olduğunda en uzun kart kazanır ve gün açıldıkça Defter durumu da onunla uzar.
 *
 * Çözüm: iç kap `position: absolute`. Mutlak konumlu öğeler ebeveynin doğal
 * yüksekliğine katılmaz; dolayısıyla kartın doğal boyu = başlık + etiketler +
 * aşağıdaki min-height. Bu, Defter durumu'ndan kısa olduğu için satırın boyunu
 * o belirler, kart ona esner, liste de içinde kayar.
 *
 * Önceki iki deneme neden tutmadı:
 *  - max-height: 55vh → TAVAN'dı, varsayılan halde (~424px) hiç aşılmıyordu.
 *  - height: clamp(...) → sabitti ama Defter durumu ile alakasızdı; görseldeki
 *    kocaman boşluk buydu.
 *
 * min-height: veri azken kart gülünç derecede kısalmasın (ör. Defter durumu boş).
 */
.dash-recent-list {
  position: relative;
  flex: 1 1 auto;
  min-height: 140px;
}
.dash-recent-scroll {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  /* Kaydırma çubuğu son satırı kesmesin. */
  padding-inline-end: 4px;
}
.dash-side {
  flex: 1 1 260px;
  min-width: 0;
}

/* Yüzdeler sağda hizalı: değişken genişlikte olsalar sütun tırtıklı görünür. */
.dash-pct {
  min-width: 38px;
  text-align: end;
}
</style>
