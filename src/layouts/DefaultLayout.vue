<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'
import { useRoute } from 'vue-router'

import { useTrnsFormStore } from '@/features/trnForm/store'
import TrnFormDialog from '@/features/trnForm/components/TrnFormDialog.vue'

const { t } = useI18n()
const { mobile } = useDisplay()
const route = useRoute()
const trnForm = useTrnsFormStore()

// icon-fonts: semantik ikon alias'ları ($navX) — tek kaynaktan yönetilir.
type NavItem = { key: string, to: string, icon: string, labelKey: string }
const navItems: NavItem[] = [
  { key: 'dashboard', to: '/dashboard', icon: '$navDashboard', labelKey: 'nav.dashboard' },
  { key: 'wallets', to: '/wallets', icon: '$navWallets', labelKey: 'nav.wallets' },
  { key: 'categories', to: '/categories', icon: '$navCategories', labelKey: 'nav.categories' },
  { key: 'tags', to: '/tags', icon: '$navTags', labelKey: 'nav.tags' },
  { key: 'stat', to: '/stat', icon: '$navStat', labelKey: 'nav.stat' },
  { key: 'settings', to: '/settings', icon: '$navSettings', labelKey: 'nav.settings' },
]

const activeKey = computed(() => (route.meta.navKey as string) ?? 'dashboard')

// Mobil alt bar sıkışmasın: ikincil öğeler yukarı açılan "Daha fazla" menüsünde toplanır.
const MORE_KEYS = ['categories', 'tags', 'settings']
const moreItems = computed(() => navItems.filter(i => MORE_KEYS.includes(i.key)))
const isMoreActive = computed(() => MORE_KEYS.includes(activeKey.value))
const moreMenu = ref(false)

function onAdd() {
  trnForm.openFormForCreate()
}
</script>

<template>
  <!-- Masaüstü: yan gezinme rayı -->
  <v-navigation-drawer v-if="!mobile" rail permanent>
    <v-list nav aria-label="Ana menü">
      <v-list-item
        v-for="item in navItems"
        :key="item.key"
        :to="item.to"
        :prepend-icon="item.icon"
        :title="t(item.labelKey)"
        :active="activeKey === item.key"
      />
    </v-list>
    <template #append>
      <div class="pa-2">
        <v-btn icon="$add" color="primary" size="small" :aria-label="t('nav.add')" @click="onAdd" />
      </div>
    </template>
  </v-navigation-drawer>

  <v-app-bar flat density="comfortable">
    <v-app-bar-title class="font-weight-bold">{{ t(`nav.${activeKey}`) }}</v-app-bar-title>
  </v-app-bar>

  <v-main>
    <v-container id="main-content" tabindex="-1" class="pa-0" :class="{ 'pb-16': mobile }" fluid>
      <slot />
    </v-container>
  </v-main>

  <!-- Mobil: alt gezinme + orta ekle butonu -->
  <v-bottom-navigation v-if="mobile" grow>
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
            rounded="lg"
          />
        </v-list>
      </v-menu>
    </v-btn>
  </v-bottom-navigation>

  <!-- İşlem formu (global) -->
  <TrnFormDialog />
</template>
