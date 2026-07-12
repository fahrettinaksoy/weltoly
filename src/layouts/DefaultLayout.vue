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

type NavItem = { key: string, to: string, icon: string, labelKey: string }

const navItems: NavItem[] = [
  { key: 'dashboard', to: '/dashboard', icon: 'mdi-view-dashboard-outline', labelKey: 'nav.dashboard' },
  { key: 'wallets', to: '/wallets', icon: 'mdi-wallet-outline', labelKey: 'nav.wallets' },
  { key: 'categories', to: '/categories', icon: 'mdi-shape-outline', labelKey: 'nav.categories' },
  { key: 'stat', to: '/stat', icon: 'mdi-chart-box-outline', labelKey: 'nav.stat' },
  { key: 'settings', to: '/settings', icon: 'mdi-cog-outline', labelKey: 'nav.settings' },
]

const activeKey = computed(() => (route.meta.navKey as string) ?? 'dashboard')

function onAdd() {
  trnForm.openFormForCreate()
}
</script>

<template>
  <!-- Masaüstü: yan gezinme rayı -->
  <v-navigation-drawer v-if="!mobile" rail permanent>
    <v-list nav>
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
        <v-btn icon="mdi-plus" color="primary" size="small" @click="onAdd" />
      </div>
    </template>
  </v-navigation-drawer>

  <v-app-bar flat density="comfortable">
    <v-app-bar-title class="font-weight-bold">{{ t(`nav.${activeKey}`) }}</v-app-bar-title>
  </v-app-bar>

  <v-main>
    <v-container class="pa-0" :class="{ 'pb-16': mobile }" fluid>
      <slot />
    </v-container>
  </v-main>

  <!-- Mobil: alt gezinme + orta ekle butonu -->
  <v-bottom-navigation v-if="mobile" grow>
    <v-btn to="/dashboard" :active="activeKey === 'dashboard'">
      <v-icon icon="mdi-view-dashboard-outline" />
      <span>{{ t('nav.dashboard') }}</span>
    </v-btn>
    <v-btn to="/wallets" :active="activeKey === 'wallets'">
      <v-icon icon="mdi-wallet-outline" />
      <span>{{ t('nav.wallets') }}</span>
    </v-btn>
    <v-btn color="primary" @click="onAdd">
      <v-icon icon="mdi-plus-circle" size="28" />
      <span>{{ t('nav.add') }}</span>
    </v-btn>
    <v-btn to="/stat" :active="activeKey === 'stat'">
      <v-icon icon="mdi-chart-box-outline" />
      <span>{{ t('nav.stat') }}</span>
    </v-btn>
    <v-btn to="/settings" :active="activeKey === 'settings'">
      <v-icon icon="mdi-cog-outline" />
      <span>{{ t('nav.settings') }}</span>
    </v-btn>
  </v-bottom-navigation>

  <!-- İşlem formu (global) -->
  <TrnFormDialog />
</template>
