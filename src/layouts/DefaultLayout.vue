<script setup lang="ts">
import type { PageHeaderDef } from '@/composables/usePageHeader'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import { useDisplay } from 'vuetify'
import { appBarActions } from '@/composables/useAppBarAction'
import { pageHeader } from '@/composables/usePageHeader'
import TrnFormDialog from '@/features/trnForm/components/TrnFormDialog.vue'
import { useTrnsFormStore } from '@/features/trnForm/store'

const { t } = useI18n()
const { mobile } = useDisplay()
const route = useRoute()
const trnForm = useTrnsFormStore()
const actions = appBarActions()
const override = pageHeader()

// icon-fonts: semantik ikon alias'ları ($navX) — tek kaynaktan yönetilir.
interface NavItem { key: string, to: string, icon: string, labelKey: string }
const navItems: NavItem[] = [
  { key: 'dashboard', to: '/dashboard', icon: '$navDashboard', labelKey: 'nav.dashboard' },
  { key: 'wallets', to: '/wallets', icon: '$navWallets', labelKey: 'nav.wallets' },
  { key: 'trns', to: '/trns', icon: '$navTrns', labelKey: 'nav.trns' },
  { key: 'categories', to: '/categories', icon: '$navCategories', labelKey: 'nav.categories' },
  { key: 'tags', to: '/tags', icon: '$navTags', labelKey: 'nav.tags' },
  { key: 'stat', to: '/stat', icon: '$navStat', labelKey: 'nav.stat' },
  { key: 'settings', to: '/settings', icon: '$navSettings', labelKey: 'nav.settings' },
]

const activeKey = computed(() => (route.meta.navKey as string) ?? 'dashboard')
const activeIcon = computed(() => navItems.find(i => i.key === activeKey.value)?.icon ?? '$navDashboard')

// Bant başlığı: sayfa devralmadıysa rotanın statik etiketi.
// Detay sayfaları usePageHeader ile varlığın kendi adını yazar.
const header = computed(() => override.value ?? {
  title: t(`nav.${activeKey.value}`),
  desc: t(`pageDesc.${activeKey.value}`),
  icon: activeIcon.value,
  backTo: undefined as string | undefined,
  cardTitle: undefined as string | undefined,
  tabs: undefined as PageHeaderDef['tabs'],
})

// Mobil alt bar sıkışmasın: ikincil öğeler yukarı açılan "Daha fazla" menüsünde toplanır.
const MORE_KEYS = ['trns', 'categories', 'tags', 'settings']
const moreItems = computed(() => navItems.filter(i => MORE_KEYS.includes(i.key)))
const isMoreActive = computed(() => MORE_KEYS.includes(activeKey.value))
const moreMenu = ref(false)

function onAdd() {
  trnForm.openFormForCreate()
}
</script>

<template>
  <!-- Masaüstü: yan gezinme rayı (ikon) -->
  <v-navigation-drawer v-if="!mobile" rail permanent>
    <v-list nav aria-label="Ana menü">
      <v-list-item
        v-for="item in navItems"
        :key="item.key"
        :to="item.to"
        :prepend-icon="item.icon"
        :title="t(item.labelKey)"
        :active="activeKey === item.key"
        color="primary"
      />
    </v-list>
    <template #append>
      <div class="pa-2">
        <v-btn icon="$add" color="primary" size="small" :aria-label="t('nav.add')" @click="onAdd" />
      </div>
    </template>
  </v-navigation-drawer>

  <!-- Header: yalnız mobilde. Masaüstünde marka zaten pencere başlığında ("Weltoly")
       yazdığı için app-bar tekrar olurdu; kaldırıldı → sol ray tam yükseklik, içerik
       doğrudan primary hero bandıyla başlar. -->
  <v-app-bar v-if="mobile" elevation="5" color="primary" flat :height="56">
    <div class="d-flex align-center ga-2 ps-3">
      <!-- Marka işareti: rozet değil logo → ayardan bağımsız daire kalır. -->
      <v-avatar color="white" size="32" rounded="circle">
        <v-icon icon="mdi-wallet-outline" color="primary" size="18" />
      </v-avatar>
      <span class="text-subtitle-1 font-weight-bold">Weltoly</span>
    </div>
  </v-app-bar>

  <v-main>
    <!-- Primary hero bandı: sayfa başlığı + açıklama (app bar ile kart arasında).
         rounded="0": bant HER ZAMAN kare — ekranın kenarına dayanıyor, yuvarlanırsa
         köşelerinde arka plan sızar. Ayardan bağımsız.
         DİKKAT: burada `tile` KULLANILAMAZ. tile yalnız .rounded-0 CLASS'ını ekler;
         defaults'tan gelen rounded ise inline STYLE üretir ve class'ı ezer (ölçüldü).
         rounded="0" prop olarak default'u değiştirir, style hiç üretilmez. -->
    <v-sheet color="primary" height="140" rounded="0">
      <div class="d-flex align-center ga-3 px-5 pt-5">
        <!-- Geri butonu yalnız detay sayfalarında (backTo verilmişse). -->
        <v-btn
          v-if="header.backTo"
          :to="header.backTo"
          icon="mdi-arrow-left"
          variant="text"
          :aria-label="t('common.back')"
        />
        <v-icon v-if="header.icon" :icon="header.icon" size="30" />
        <div class="overflow-hidden">
          <div class="text-h6 font-weight-bold text-truncate">
            {{ header.title }}
          </div>
          <div v-if="header.desc" class="text-body-2 text-truncate" style="opacity: 0.85;">
            {{ header.desc }}
          </div>
        </div>
      </div>
    </v-sheet>

    <!-- Üzerine binen "floating" içerik kartı -->
    <div class="px-5">
      <v-card
        class="page-hero-card"
        :class="{ 'page-hero-card--mobile': mobile }"
        elevation="4"
      >
        <!-- Kart başlığı: yalnız sayfaya özel eylem varsa render edilir (başlık + buton) -->
        <template v-if="actions.length">
          <div class="d-flex align-center ga-2 pa-3">
            <!-- Sekme varsa başlığın yerini alır (detay sayfası: Özet | İşlemler).
                 Yoksa şerit başlığı: listede "Liste", detayda sayfanın verdiği. -->
            <!-- hide-slider: aktif sekme çizgiyle değil tonal zeminle belirtilir —
                 ayarlardaki sekmelerle aynı desen (MD3). -->
            <v-tabs
              v-if="header.tabs"
              :model-value="header.tabs.model"
              color="primary"
              density="comfortable"
              hide-slider
              class="header-tabs"
              @update:model-value="header.tabs.onChange(String($event))"
            >
              <v-tab
                v-for="tab in header.tabs.items"
                :key="tab.value"
                :value="tab.value"
                :prepend-icon="tab.icon"
              >
                {{ tab.label }}
              </v-tab>
            </v-tabs>
            <span v-else class="text-h6 font-weight-bold ps-1">
              {{ header.cardTitle ?? t('common.list') }}
            </span>
            <v-spacer />
            <!-- Dar ekranda metin gizlenir, buton ikona düşer; aria-label her zaman
                 tam metni taşır → ekran okuyucu için bilgi kaybı yok. -->
            <v-btn
              v-for="action in actions"
              :key="action.label"
              :prepend-icon="mobile ? undefined : action.icon"
              :icon="mobile ? action.icon : undefined"
              :color="action.color ?? 'primary'"
              :variant="action.variant ?? 'tonal'"
              :aria-label="action.label"
              @click="action.onClick()"
            >
              <template v-if="!mobile">
                {{ action.label }}
              </template>
            </v-btn>
          </div>
          <v-divider />
        </template>

        <!-- Kaydırılabilir içerik alanı -->
        <div id="main-content" tabindex="-1" class="page-hero-content">
          <slot />
        </div>
      </v-card>
    </div>
  </v-main>

  <!-- Mobil: alt gezinme + orta ekle butonu -->
  <v-bottom-navigation v-if="mobile" grow color="primary" :elevation="3">
    <v-btn to="/dashboard" :active="activeKey === 'dashboard'">
      <v-icon icon="$navDashboard" />
      <span>{{ t('nav.dashboard') }}</span>
    </v-btn>
    <v-btn to="/wallets" :active="activeKey === 'wallets'">
      <v-icon icon="$navWallets" />
      <span>{{ t('nav.wallets') }}</span>
    </v-btn>
    <v-btn color="primary" :aria-label="t('nav.add')" @click="onAdd">
      <v-icon icon="$addCircle" size="28" />
      <span>{{ t('nav.add') }}</span>
    </v-btn>
    <v-btn to="/stat" :active="activeKey === 'stat'">
      <v-icon icon="$navStat" />
      <span>{{ t('nav.stat') }}</span>
    </v-btn>

    <!-- Daha fazla: yukarı açılan menü (Kategoriler · Etiketler · Ayarlar) -->
    <v-btn :active="isMoreActive">
      <v-icon icon="mdi-dots-horizontal" />
      <span>{{ t('nav.more') }}</span>
      <v-menu
        v-model="moreMenu"
        activator="parent"
        location="top end"
        :offset="12"
      >
        <v-list nav density="comfortable" min-width="200" class="mb-1">
          <v-list-item
            v-for="item in moreItems"
            :key="item.key"
            :to="item.to"
            :prepend-icon="item.icon"
            :title="t(item.labelKey)"
            :active="activeKey === item.key"
            color="primary"
          />
        </v-list>
      </v-menu>
    </v-btn>
  </v-bottom-navigation>

  <!-- İşlem formu (global) -->
  <TrnFormDialog />
</template>

<style scoped>
/* Floating kart primary bandın üzerine biner; bandın görünen kısmında başlık + açıklama durur.
   Görünen bant = --band-h - --overlap; başlık + açıklama bloğu buraya oturur.
   Kart ekran yüksekliğini baz alır: kart sabit, içi kaydırılır. */
.page-hero-card {
  --band-h: 140px;
  --overlap: 56px;
  --bar-h: 56px;

  margin-top: calc(var(--overlap) * -1);
  display: flex;
  flex-direction: column;
  /* Masaüstü: app-bar yok → kartın üstten uzaklığı = görünen bant. 20px alt boşluk. */
  height: calc(100dvh - (var(--band-h) - var(--overlap)) - 20px);
}

/* Mobil: üstte app-bar, altta gezinme çubuğu (--bar-h) kadar daha kısa. */
.page-hero-card--mobile {
  height: calc(100dvh - var(--bar-h) - (var(--band-h) - var(--overlap)) - var(--bar-h) - 12px);
}

/* Yalnız içerik kaydırılır; başlık ve divider sabit. */
.page-hero-content {
  flex: 1 1 auto;
  overflow-y: auto;
}

/* Aktif sekme: alttaki çizgi (slider) yerine tonal primary zemin — ayarlardaki
   sekmelerle aynı desen. Zemin 0.12 opaklıkla primary: tema/palet değişince
   birlikte kayar.

   Yuvarlaklık için burada iş yapmaya gerek YOK: VTab içeride bir VBtn render
   eder ve `.v-tab` sınıfı o butonun ÜZERİNDEDİR → defaults.ts'teki
   VBtn.rounded ona da iner (ölçüldü). Vuetify'ın VTab.css'teki
   `.v-tab { border-radius: 0 }` kuralı (@layer vuetify-overrides) bunu ezemez:
   default'un ürettiği INLINE style her katmanlı kuralı yener.
   DİKKAT — VBtn default'larının HEPSİ inmez: VTab `variant`i kendi prop
   default'unda 'text' diye sabitler, bizim `variant: 'flat'` oraya geçmez
   (ölçüldü). Sekmenin şeffaf kalmasının sebebi bu; zaten istenen de o. */
.header-tabs :deep(.v-tab--selected) {
  background: rgba(var(--v-theme-primary), 0.12);
}

/* Pill'ler birbirine yapışmasın. Ayarlarda sekmeler dikey (margin-bottom),
   burada yatay → sağa boşluk. */
.header-tabs :deep(.v-tab) {
  margin-inline-end: 4px;
}
</style>
