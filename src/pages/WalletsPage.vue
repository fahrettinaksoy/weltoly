<script setup lang="ts">
import type { WalletId } from '@/features/wallets/types'
import { useI18n } from 'vue-i18n'

import { useRouter } from 'vue-router'
import AppEmptyState from '@/components/AppEmptyState.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useAppBarAction } from '@/composables/useAppBarAction'
import { ADJUSTMENT_ID } from '@/features/categories/pseudoCategories'
import { useCurrenciesStore } from '@/features/currencies/store'
import { useTrnsStore } from '@/features/trns/store'
import { TrnType } from '@/features/trns/types'
import { useUserStore } from '@/features/user/store'
import WalletFormDialog from '@/features/wallets/components/WalletFormDialog.vue'
import { toBaseAmount } from '@/features/wallets/lib/baseAmount'
import { useWalletsStore } from '@/features/wallets/store'
import { walletIdsOfTrn } from '@/features/wallets/trnLink'
import { walletIcon } from '@/features/wallets/walletMeta'

const { t } = useI18n()
const router = useRouter()
const walletsStore = useWalletsStore()
const currenciesStore = useCurrenciesStore()
const userStore = useUserStore()
const trnsStore = useTrnsStore()
const fmt = useFormat()

const showDialog = ref(false)
const editId = ref<WalletId | null>(null)

const search = ref('')

/** Silme onayı bekleyen satır. null = dialog kapalı. */
const pendingDelete = ref<WalletRow | null>(null)

/**
 * Silme onaylandı. Sonuç bildirimi (başarı/hata) store'un içinden merkezî
 * snackbar kuyruğuna düşer — sayfa bildirim bağlamaz.
 */
function confirmDelete() {
  const row = pendingDelete.value
  if (!row) return
  walletsStore.deleteWallet(row.id)
  pendingDelete.value = null
}

function openNew() {
  editId.value = null
  showDialog.value = true
}
useAppBarAction(() => ({ icon: '$add', label: t('wallets.add'), onClick: openNew }))

function openEdit(id: WalletId) {
  editId.value = id
  showDialog.value = true
}

interface WalletRow {
  id: WalletId
  name: string
  color: string
  icon: string
  typeLabel: string
  desc: string
  currency: string
  /** Cüzdanın kendi para birimindeki bakiye (ekranda bu gösterilir). */
  amount: number
  /**
   * Temel para birimine çevrilmiş karşılığı — sıralama, pay ve pasta bunu kullanır.
   * null = kur eksik, karşılık BİLİNMİYOR (Y-1: uydurma 1:1 yok).
   */
  base: number | null
  /** Toplam varlık içindeki pay (%). Negatif bakiyede ve kur eksikken 0. */
  share: number
  /** Gelir/gider toplamı, cüzdanın kendi para biriminde (ekranda bu görünür). */
  income: number
  expense: number
  /**
   * Temel para birimi karşılıkları — SIRALAMA bunları kullanır.
   * null = kur eksik, karşılık bilinmiyor (Y-1: uydurma 1:1 yok).
   */
  incomeBase: number | null
  expenseBase: number | null
  /** Bu cüzdanı ilgilendiren TÜM işlem adedi (transfer + düzeltme dahil). */
  trnCount: number
  withdrawal: boolean
  excluded: boolean
  archived: boolean
  isDefault: boolean
}

/**
 * Cüzdan başına gelir/gider toplamı (kendi para biriminde).
 * Transferler ve düzeltmeler HARİÇ — bunlar gelir/gider değil (muhasebe kuralı,
 * shared/lib/getTotal.ts ile aynı). Dahil etseydik bir cüzdandan diğerine para
 * taşımak her ikisinde de sahte gelir/gider üretirdi.
 */
const flowsByWallet = computed(() => {
  const map = new Map<WalletId, { income: number; expense: number }>()
  const trns = trnsStore.items
  if (!trns) return map
  for (const trnId in trns) {
    const trn = trns[trnId]!
    if (trn.type === TrnType.Transfer || trn.categoryId === ADJUSTMENT_ID) continue
    const entry = map.get(trn.walletId) ?? { income: 0, expense: 0 }
    if (trn.type === TrnType.Income) entry.income += trn.amount
    else entry.expense += trn.amount
    map.set(trn.walletId, entry)
  }
  return map
})

/**
 * Cüzdan başına işlem adedi. Gelir/giderin aksine transfer ve düzeltmeler DAHİL:
 * soru "bu cüzdanla kaç işlem yapıldı", "ne kadar gelir/gider oldu" değil.
 * Transfer iki cüzdanda da sayılır — her ikisinde de gerçekten bir hareket var.
 */
const trnCountByWallet = computed(() => {
  const map = new Map<WalletId, number>()
  const trns = trnsStore.items
  if (!trns) return map
  for (const trnId in trns) {
    for (const walletId of walletIdsOfTrn(trns[trnId]!))
      map.set(walletId, (map.get(walletId) ?? 0) + 1)
  }
  return map
})

const baseRows = computed(() =>
  walletsStore.sortedIds.flatMap((id) => {
    const w = walletsStore.itemsComputed[id]
    if (!w) return []
    // Kur eksikse base karşılığı YOK (toBaseAmount null döner) — pay çubuğu ve
    // pasta onu atlar, store.totals da net'e katmıyor. Kural tek kaynakta.
    const toBase = (v: number) => toBaseAmount(v, w.rate)
    const flow = flowsByWallet.value.get(id) ?? { income: 0, expense: 0 }
    return [
      {
        id,
        name: w.name,
        color: w.color,
        icon: walletIcon(w), // seçilmişse o, değilse tür varsayılanı
        typeLabel: t(`wallets.types.${w.type}`),
        desc: w.desc,
        currency: w.currency,
        amount: w.amount,
        base: toBase(w.amount),
        income: flow.income,
        expense: flow.expense,
        incomeBase: toBase(flow.income),
        expenseBase: toBase(flow.expense),
        trnCount: trnCountByWallet.value.get(id) ?? 0,
        withdrawal: w.isWithdrawal,
        excluded: w.isExcludeInTotal,
        archived: w.isArchived,
        isDefault: userStore.defaultWalletId === id
      }
    ]
  })
)

/**
 * Varlık/borç/net artık STORE'da (walletsStore.totals) — Panel de aynı rakamı
 * gösteriyor, iki yerde ayrı hesaplanırsa zamanla sessizce ayrışırlardı.
 */
const totals = computed(() => walletsStore.totals)
const debtRatio = computed(() => walletsStore.debtRatio)

const rows = computed<WalletRow[]>(() =>
  baseRows.value.map((r) => ({
    ...r,
    share:
      r.base != null && r.base > 0 && totals.value.assets ? (r.base / totals.value.assets) * 100 : 0
  }))
)

/** Özet sayaçları: cüzdanlarda anlamlı olan para, adet değil. */
const kpis = computed(() => [
  {
    key: 'net',
    label: t('wallets.stats.net'),
    value: fmt.money(totals.value.net, currenciesStore.base)
  },
  {
    key: 'assets',
    label: t('wallets.stats.assets'),
    value: fmt.money(totals.value.assets, currenciesStore.base)
  },
  {
    key: 'debts',
    label: t('wallets.stats.debts'),
    value: fmt.money(totals.value.debts, currenciesStore.base)
  }
])

/** Donut'ta ayrı dilim olarak gösterilecek en yüksek bakiyeli cüzdan sayısı. */
const PIE_LIMIT = 6

/**
 * Donut YALNIZ varlıkları gösterir: pozitif bakiyeli, toplama dahil cüzdanlar.
 * Negatif bakiye (borç) bir pasta dilimi olamaz — bütünün parçası değil, eksisi.
 * Borç, yandaki sayaçta ve borç oranı halkasında okunur.
 */
const pieItems = computed(() => {
  // Kuru olmayan cüzdan pastaya giremez: dilim büyüklüğü base karşılığıdır,
  // bilinmiyorsa çizmek uydurmak olur (store.totals da onu net'e katmıyor).
  const assets = rows.value
    .filter((r): r is typeof r & { base: number } => !r.excluded && r.base != null && r.base > 0)
    .toSorted((a, b) => b.base - a.base)

  const items = assets.slice(0, PIE_LIMIT).map((r) => ({
    key: r.id,
    title: r.name,
    value: r.base,
    color: r.color
  }))

  const restBase = assets.slice(PIE_LIMIT).reduce((sum, r) => sum + r.base, 0)
  if (restBase > 0) {
    items.push({
      key: '__rest',
      title: t('wallets.chart.other', { count: assets.length - PIE_LIMIT }),
      value: restBase,
      color: 'grey'
    })
  }
  return items
})

/**
 * Kolonlar. Bakiye kolonunun anahtarı 'base' (temel para birimi karşılığı):
 * ham 'amount'a göre sıralamak farklı para birimlerini yan yana kıyaslardı —
 * 100 EUR ile 100 USD eşit görünürdü. Hücrede yine cüzdanın kendi birimi yazar.
 */
// nowrap: başlıklar iki satıra sarmasın ("Toplam D." gibi) — satır yüksekliği
// kolondan kolona değişmesin diye.

/**
 * Anahtar/sayı kolonları için dar hücre: Vuetify'ın 16px yan boşluğu yerine 8px.
 * (VDataTableColumn'ın `noPadding`i normalde yalnız seçim/genişletme kolonlarına
 * veriliyor; headerProps/cellProps en SONDA merge edildiği için buradan
 * geçirilebiliyor — kaynak: VDataTableHeaders.js `mergeProps(..., headerProps)`.)
 *
 * Kolon genişliğinin ALT SINIRINI hücre değil BAŞLIK METNİ belirliyor: içeride
 * yalnız bir anahtar var, ama başlık nowrap. Daha dar verilirse başlık "…" ile
 * kesilir. Bu yüzden metni kısaltmak (Toplam dışı → Toplam D.) genişlik
 * kazandıran asıl adım; buradaki değerler o metinlere göre.
 */
const TIGHT = { headerProps: { noPadding: true }, cellProps: { noPadding: true } } as const

const headers = computed(
  () =>
    [
      {
        title: t('wallets.table.name'),
        key: 'name',
        sortable: true,
        width: 280,
        nowrap: true,
        // Açıklamanın ayrı kolonu yok, ad hücresinin ALTINDA duruyor. Arama kolonlar
        // üzerinden çalışır (VDataTable: transform → item.columns), yani kolon kalkınca
        // açıklamaya göre arama da SESSİZCE ölürdü. Bu filtre onu geri verir:
        // hücrede ne görünüyorsa arama da onu bulur.
        filter: (value: string, query: string, item?: { raw?: WalletRow }) =>
          `${value} ${item?.raw?.desc ?? ''}`
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase())
      },
      { title: t('wallets.type'), key: 'typeLabel', sortable: true, width: 130, nowrap: true },
      {
        title: t('wallets.table.balance'),
        key: 'base',
        align: 'end',
        sortable: true,
        width: 260,
        nowrap: true
      },
      {
        title: t('wallets.table.income'),
        key: 'incomeBase',
        align: 'end',
        sortable: true,
        width: 130,
        nowrap: true
      },
      {
        title: t('wallets.table.expense'),
        key: 'expenseBase',
        align: 'end',
        sortable: true,
        width: 130,
        nowrap: true
      },
      {
        title: t('wallets.table.trnCount'),
        key: 'trnCount',
        align: 'end',
        sortable: true,
        width: 84,
        nowrap: true,
        ...TIGHT
      },
      {
        title: t('wallets.table.withdrawal'),
        key: 'withdrawal',
        align: 'center',
        sortable: true,
        width: 112,
        nowrap: true,
        ...TIGHT
      },
      {
        title: t('wallets.table.excluded'),
        key: 'excluded',
        align: 'center',
        sortable: true,
        width: 100,
        nowrap: true,
        ...TIGHT
      },
      {
        title: t('wallets.table.archived'),
        key: 'archived',
        align: 'center',
        sortable: true,
        width: 88,
        nowrap: true,
        ...TIGHT
      },
      {
        title: t('wallets.table.default'),
        key: 'isDefault',
        align: 'center',
        sortable: true,
        width: 104,
        nowrap: true,
        ...TIGHT
      },
      { title: '', key: 'actions', align: 'end', sortable: false, width: 104 }
    ] as const
)

/** Varsayılanı ayarla; zaten varsayılansa seçimi kaldır (tek işaretçi). */
function toggleDefault(row: WalletRow) {
  userStore.saveDefaultWalletId(row.isDefault ? null : row.id)
}

/** Tabloda doğrudan değiştirilebilen cüzdan bayrakları. */
type WalletFlag = 'isWithdrawal' | 'isExcludeInTotal' | 'isArchived'

/**
 * Bayrağı tersine çevirip kaydeder. Kaynak itemsComputed DEĞİL items:
 * computed sürüm hesaplanmış amount/rate taşır, onu geri yazmak veriyi kirletirdi.
 */
function toggleFlag(row: WalletRow, field: WalletFlag) {
  const wallet = walletsStore.items?.[row.id]
  if (!wallet) return
  walletsStore.saveWallet({ id: row.id, values: { ...wallet, [field]: !wallet[field] } })
}

/**
 * Satıra tıklamak DETAY sayfasını açar; düzenleme satırdaki kalem butonunda.
 * (Tıklamanın formu açması, listeye göz atmayı zorlaştırıyordu.)
 */
function onRowClick(_event: unknown, { item }: { item: WalletRow }) {
  router.push(`/wallets/${item.id}`)
}
</script>

<template>
  <div class="wallets-page pa-4">
    <!-- Yükleniyor: boş durumdan ÖNCE. Store'lar items=null ile başlıyor ve ilk
         SQLite turu dönene kadar öyle kalıyor; bu null "kayıt yok" sanılıp
         yükleme sırasında "henüz cüzdan yok + Ekle" gösteriliyordu. `isLoaded`
         dört store'da vardı ama hiçbir bileşende okunmuyordu. -->
    <v-skeleton-loader
      v-if="!walletsStore.isLoaded"
      type="heading, table-heading, list-item-two-line@6"
      class="bg-transparent"
    />

    <template v-else-if="walletsStore.hasItems">
      <!-- Özet şeridi: tek satır. Asıl içerik tablo — özet ekranı yemesin.
           Donutun legend'i yok: tablo zaten renk rozeti + pay çubuğu gösteriyor. -->
      <v-sheet color="surface-light" class="d-flex align-center ga-6 pa-4 mb-3 flex-wrap flex-0-0">
        <!-- Hiç varlık yoksa donut anlamsız → gizle. -->
        <v-pie
          v-if="totals.assets > 0"
          :items="pieItems"
          :size="80"
          :inner-cut="64"
          :gap="2"
          rounded="2"
          tooltip
        >
          <template #center>
            <v-icon icon="mdi-wallet-outline" size="20" class="text-medium-emphasis" />
          </template>
        </v-pie>

        <div v-for="kpi in kpis" :key="kpi.key">
          <div class="text-h5 font-weight-bold">
            {{ kpi.value }}
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ kpi.label }}
          </div>
        </div>

        <v-spacer />

        <!-- Borç oranı: borcun varlığa oranı. Yüksekse uyarı rengine döner. -->
        <div class="d-flex align-center ga-3">
          <div class="text-caption text-medium-emphasis">
            {{ t('wallets.stats.debtRatio') }}
          </div>
          <v-progress-circular
            :model-value="Math.min(debtRatio, 100)"
            :size="48"
            :width="5"
            :color="debtRatio > 50 ? 'error' : 'primary'"
          >
            <span class="text-caption font-weight-bold">{{ fmt.percent(debtRatio) }}</span>
          </v-progress-circular>
        </div>
      </v-sheet>

      <!-- Arama. variant/density global-configuration'dan (defaults.ts) gelir;
           yuvarlaklığı --app-radius belirler. Eski sarmalayıcı v-sheet kaldırıldı:
           filled variant'ın alt çizgisini gizlemek içindi, outlined'da gereksiz. -->
      <v-text-field
        v-model="search"
        :placeholder="t('wallets.search')"
        prepend-inner-icon="mdi-magnify"
        clearable
        class="mb-3 flex-0-0"
      />

      <!-- Tablo. Sıralama + arama filtresi VDataTable'ın kendi işi. -->
      <v-data-table-virtual
        :headers="headers"
        :items="rows"
        :search="search"
        item-value="id"
        density="comfortable"
        hover
        fixed-header
        class="bg-transparent wallets-table"
        :sort-by="[{ key: 'base', order: 'desc' }]"
        @click:row="onRowClick"
      >
        <!-- Cüzdan: tür ikonlu rozet + ad, altında açıklama (ayrı kolon yerine).
             İki satır KASITLI ve her satırda aynı → yükseklik tırtıklaşmaz.
             Her iki metin de tek satır; sığmayan kısım "…" ile kesilir. -->
        <template #[`item.name`]="{ item }">
          <div class="d-flex align-center ga-3 py-2" :class="{ 'text-disabled': item.archived }">
            <v-avatar :color="item.color" size="32">
              <v-icon :icon="item.icon" color="white" size="18" />
            </v-avatar>
            <div class="wallets-name">
              <div class="font-weight-medium text-truncate">
                {{ item.name }}
              </div>
              <div v-if="item.desc" class="text-caption text-medium-emphasis text-truncate">
                {{ item.desc }}
              </div>
            </div>
          </div>
        </template>

        <!-- Varsayılan: tıklanabilir. Radyo düğmesi gibi davranır — birini
             seçmek diğerini bırakır, çünkü işaretçi tek. -->
        <template #[`item.isDefault`]="{ item }">
          <v-btn
            :icon="item.isDefault ? 'mdi-star' : 'mdi-star-outline'"
            :color="item.isDefault ? 'warning' : undefined"
            :class="{ 'text-disabled': !item.isDefault }"
            variant="text"
            size="small"
            :aria-label="t('wallets.setDefault')"
            :aria-pressed="item.isDefault"
            @click.stop="toggleDefault(item)"
          />
        </template>

        <template #[`item.withdrawal`]="{ item }">
          <!-- @click.stop: satır tıklaması düzenlemeyi açıyor, kutu onu tetiklemesin. -->
          <div class="d-flex justify-center" @click.stop>
            <v-switch
              :model-value="item.withdrawal"
              color="success"
              density="compact"
              :aria-label="t('wallets.withdrawal')"
              @update:model-value="toggleFlag(item, 'isWithdrawal')"
            />
          </div>
        </template>

        <template #[`item.excluded`]="{ item }">
          <!-- @click.stop: satır tıklaması düzenlemeyi açıyor, kutu onu tetiklemesin. -->
          <div class="d-flex justify-center" @click.stop>
            <v-switch
              :model-value="item.excluded"
              color="warning"
              density="compact"
              :aria-label="t('wallets.excludeInTotal')"
              @update:model-value="toggleFlag(item, 'isExcludeInTotal')"
            />
          </div>
        </template>

        <template #[`item.archived`]="{ item }">
          <!-- @click.stop: satır tıklaması düzenlemeyi açıyor, kutu onu tetiklemesin. -->
          <div class="d-flex justify-center" @click.stop>
            <v-switch
              :model-value="item.archived"
              color="grey"
              density="compact"
              :aria-label="t('wallets.archived')"
              @update:model-value="toggleFlag(item, 'isArchived')"
            />
          </div>
        </template>

        <template #[`item.typeLabel`]="{ item }">
          <span class="text-body-2 text-medium-emphasis">{{ item.typeLabel }}</span>
        </template>

        <template #[`item.trnCount`]="{ item }">
          <span v-if="item.trnCount" class="text-body-2">{{ fmt.number(item.trnCount) }}</span>
          <span v-else class="text-disabled">—</span>
        </template>

        <!-- Gelir / gider: kendi para biriminde. Sıfırsa sönük tire — 0,00 yazmak
             satırı kalabalıklaştırır ve "veri var" izlenimi verir. -->
        <template #[`item.incomeBase`]="{ item }">
          <span v-if="item.income" class="text-body-2 text-success">
            {{ fmt.money(item.income, item.currency) }}
          </span>
          <span v-else class="text-disabled">—</span>
        </template>

        <template #[`item.expenseBase`]="{ item }">
          <span v-if="item.expense" class="text-body-2 text-error">
            {{ fmt.money(item.expense, item.currency) }}
          </span>
          <span v-else class="text-disabled">—</span>
        </template>

        <!-- Bakiye: kendi para biriminde tutar + varlık payı çubuğu.
             Negatif bakiye (borç) hata renginde, çubuksuz. -->
        <template #[`item.base`]="{ item }">
          <div class="d-flex align-center ga-3 justify-end">
            <v-progress-linear
              v-if="item.share > 0"
              :model-value="item.share"
              :color="item.color"
              height="6"
              rounded
              class="wallets-share"
            />
            <div v-else class="wallets-share" />

            <span
              class="text-body-2 font-weight-medium wallets-amount"
              :class="{ 'text-error': item.amount < 0 }"
            >
              {{ fmt.money(item.amount, item.currency) }}
            </span>
          </div>
        </template>

        <template #[`item.actions`]="{ item }">
          <div class="d-flex justify-end">
            <v-btn
              icon="mdi-pencil-outline"
              variant="text"
              size="small"
              :aria-label="t('wallets.edit')"
              @click.stop="openEdit(item.id)"
            />
            <v-btn
              icon="mdi-trash-can-outline"
              variant="text"
              size="small"
              color="error"
              :aria-label="t('common.delete')"
              @click.stop="pendingDelete = item"
            />
          </div>
        </template>

        <template #no-data>
          <AppEmptyState icon="mdi-wallet-outline" :title="t('wallets.noResults')" />
        </template>
      </v-data-table-virtual>
    </template>

    <!-- Boş durum -->
    <AppEmptyState
      v-else
      icon="mdi-wallet-plus-outline"
      :title="t('wallets.empty')"
      :text="t('wallets.emptyHint')"
      :action-text="t('wallets.add')"
      action-icon="mdi-plus"
      @action="openNew"
    />

    <WalletFormDialog v-model="showDialog" :wallet-id="editId" />

    <ConfirmDialog
      :model-value="!!pendingDelete"
      :title="pendingDelete?.name"
      :message="t('wallets.deleteConfirm')"
      @update:model-value="pendingDelete = null"
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
/* Sayfa, kartın verdiği yüksekliği tam doldurur: özet + arama sabit,
   kalan alanın tamamı tabloya gider (kart 100dvh tabanlı → tablo ekranı baz alır). */
.wallets-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
}

/* min-height:0 şart: flex öğesi varsayılan olarak içeriğinden kısalmaz,
   o zaman tablo taşar ve iç kaydırma hiç oluşmaz. */
.wallets-table {
  flex: 1 1 auto;
  min-height: 0;
}

/* Satır tıklanabilir (düzenlemeyi açar) — imleç bunu belli etsin. */
.wallets-table :deep(tbody tr) {
  cursor: pointer;
}

/* Çubuk ve tutar sabit genişlik: satırlar arasında hizalı okunsun.
   Çubuksuz satırlarda da aynı boşluk korunur (boş div), yoksa tutarlar kayardı. */
.wallets-share {
  width: 120px;
  flex: 0 0 auto;
}
.wallets-amount {
  min-width: 96px;
  text-align: end;
}
</style>
