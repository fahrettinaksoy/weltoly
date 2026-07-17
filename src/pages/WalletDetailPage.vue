<script setup lang="ts">
import type { TrnId, TrnItem } from '@/features/trns/types'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AppEmptyState from '@/components/AppEmptyState.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useAppBarAction } from '@/composables/useAppBarAction'
import { usePageHeader } from '@/composables/usePageHeader'
import { useTrnsStore } from '@/features/trns/store'
import { useUserStore } from '@/features/user/store'
import WalletFormDialog from '@/features/wallets/components/WalletFormDialog.vue'
import WalletSummary from '@/features/wallets/components/WalletSummary.vue'
import WalletTransactions from '@/features/wallets/components/WalletTransactions.vue'
import { useWalletsStore } from '@/features/wallets/store'
import { walletIdsOfTrn } from '@/features/wallets/trnLink'
import { walletIcon } from '@/features/wallets/walletMeta'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const walletsStore = useWalletsStore()
const trnsStore = useTrnsStore()
const userStore = useUserStore()

const walletId = computed(() => String(route.params.id))
const wallet = computed(() => walletsStore.itemsComputed[walletId.value] ?? null)

/**
 * Şerit sekmeleri: özet (kartlar) / işlemler (liste).
 *
 * usePageHeader'dan ÖNCE tanımlanmalı: oradaki watchEffect ANINDA çalışır ve
 * bu ref'i okur. Aşağı taşınırsa "Cannot access 'tab' before initialization"
 * ile sayfa açılışta çöker (typecheck bunu callback içinden göremez).
 */
const tab = ref<'summary' | 'trns'>('summary')

/** Bant başlığını devral: burada "Cüzdanlar" değil cüzdanın kendi adı yazmalı. */
usePageHeader(() => ({
  title: wallet.value?.name ?? t('nav.wallets'),
  desc: wallet.value ? t(`wallets.types.${wallet.value.type}`) : undefined,
  icon: wallet.value ? walletIcon(wallet.value) : '$navWallets',
  backTo: '/wallets',
  tabs: {
    items: [
      { value: 'summary', label: t('walletDetail.tabSummary'), icon: 'mdi-view-dashboard-outline' },
      { value: 'trns', label: t('walletDetail.transactions'), icon: 'mdi-swap-horizontal' },
    ],
    model: tab.value,
    onChange: (v: string) => { tab.value = v as 'summary' | 'trns' },
  },
}))

const isDefault = computed(() => userStore.defaultWalletId === walletId.value)

const showEdit = ref(false)
const confirmDelete = ref(false)

function toggleDefault() {
  userStore.saveDefaultWalletId(isDefault.value ? null : walletId.value)
}

/**
 * Cüzdan eylemleri kart şeridinde ("Detay"ın sağında) toplanır — bakiye
 * kartında dağınık duruyorlardı. Getter: yıldız, varsayılan durumuna göre
 * dolu/boş değişiyor.
 *
 * DİKKAT: useAppBarAction içindeki watchEffect ANINDA çalışır, yani buradaki
 * getter setup sırasında bir kez hemen değerlendirilir. Okuduğu her şey
 * (isDefault) bu çağrıdan ÖNCE tanımlı olmalı — aşağı taşınırsa
 * "Cannot access before initialization" ile sayfa açılışta çöker.
 */
useAppBarAction(() => [
  {
    icon: isDefault.value ? 'mdi-star' : 'mdi-star-outline',
    label: isDefault.value ? t('walletDetail.unsetDefault') : t('wallets.setDefault'),
    variant: 'text' as const,
    onClick: toggleDefault,
  },
  { icon: 'mdi-pencil-outline', label: t('common.edit'), onClick: () => (showEdit.value = true) },
  {
    icon: 'mdi-trash-can-outline',
    label: t('common.delete'),
    color: 'error',
    variant: 'text' as const,
    onClick: () => (confirmDelete.value = true),
  },
])

// --- Dönem süzgeci ------------------------------------------------------
type PeriodKey = '30' | '90' | '365' | 'all'
const period = ref<PeriodKey>('90')
const periodStart = computed(() =>
  period.value === 'all' ? 0 : Date.now() - Number(period.value) * 86_400_000,
)

// --- Bu cüzdanın işlemleri ---------------------------------------------
/** Cüzdana dokunan tüm işlemler, yeniden eskiye. Kural: walletIdsOfTrn (tek kaynak). */
const allTrns = computed(() => {
  const trns = trnsStore.items
  if (!trns)
    return [] as { id: TrnId, trn: TrnItem }[]
  const out: { id: TrnId, trn: TrnItem }[] = []
  for (const id in trns) {
    const trn = trns[id]!
    if (walletIdsOfTrn(trn).includes(walletId.value))
      out.push({ id, trn })
  }
  return out.toSorted((a, b) => b.trn.date - a.trn.date)
})

const periodTrns = computed(() => allTrns.value.filter(x => x.trn.date >= periodStart.value))

// --- Önceki dönemle karşılaştırma ---------------------------------------
/**
 * Aynı uzunlukta bir ÖNCEKİ dönem: [start - uzunluk, start).
 *
 * Neden: "₺23.830 gider" tek başına bir şey söylemiyor — çok mu, az mı? Sayaç
 * kartları referanssızdı. Geçen döneme göre yüzde, aynı rakamı yorumlanabilir
 * yapıyor.
 *
 * 'all' seçiliyken karşılaştırma YOK: "tüm zamanlar"ın öncesi diye bir şey
 * olmadığı için bu durumda null döner ve kartlar rozetsiz çizilir.
 */
const prevPeriodTrns = computed(() => {
  if (period.value === 'all')
    return null
  const len = Number(period.value) * 86_400_000
  const start = periodStart.value - len
  return allTrns.value.filter(x => x.trn.date >= start && x.trn.date < periodStart.value)
})

// --- Eylemler -----------------------------------------------------------
function remove() {
  walletsStore.deleteWallet(walletId.value)
  router.push('/wallets')
}
</script>

<template>
  <div class="wallet-detail pa-4" :class="{ 'wallet-detail--table': tab === 'trns' }">
    <!-- Cüzdan silinmiş/bilinmeyen id: sessizce boş sayfa yerine açık mesaj. -->
    <AppEmptyState v-if="!wallet" icon="mdi-wallet-outline" :title="t('walletDetail.notFound')">
      <template #action>
        <v-btn-primary to="/wallets" prepend-icon="mdi-arrow-left">
          {{ t('nav.wallets') }}
        </v-btn-primary>
      </template>
    </AppEmptyState>

    <template v-else>
      <!-- Sekmelerin İÇERİĞİ ayrı bileşenlerde (Y-7). Bu sayfa artık yalnız
           kabuk: başlık, sekme durumu, dönem seçimi, ortak veri ve diyaloglar.
           Dönem TÜRETİMLERİ burada: iki sekme de aynı listeye bakmalı. -->
      <WalletSummary
        v-if="tab === 'summary'"
        v-model:period="period"
        :wallet="wallet"
        :wallet-id="walletId"
        :all-trns="allTrns"
        :period-trns="periodTrns"
        :prev-period-trns="prevPeriodTrns"
        :is-default="isDefault"
      />

      <WalletTransactions
        v-else
        :trns="periodTrns"
        :wallet-id="walletId"
        :currency="wallet.currency"
      />

      <WalletFormDialog v-model="showEdit" :wallet-id="walletId" />

      <ConfirmDialog
        v-model="confirmDelete"
        :title="wallet.name"
        :message="t('wallets.deleteConfirm')"
        @confirm="remove"
      />
    </template>
  </div>
</template>

<style scoped>
/* Özet sekmesi: üst üste bölümler var, sayfa kendi içinde kayar. */
.wallet-detail {
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
}

/* İşlemler sekmesi: tek bir tablo var → sayfa DEĞİL tablo kaysın ve tablo
   ekran yüksekliğini doldursun (kart zaten 100dvh tabanlı). Sabit height="420"
   yerine flex zinciri: pencere büyüdükçe tablo da büyür. */
.wallet-detail--table {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
