import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

// Faz 0: temel sayfa iskeletleri. Faz 2+ ile alt rotalar (wallets/:id, stat/categories/:id vb.) eklenecek.
const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/dashboard' },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/pages/DashboardPage.vue'),
    meta: { navKey: 'dashboard' },
  },
  {
    path: '/wallets',
    name: 'wallets',
    component: () => import('@/pages/WalletsPage.vue'),
    meta: { navKey: 'wallets' },
  },
  {
    // Detay: liste satırına tıklayınca buraya gelinir (düzenleme ayrı butonda).
    path: '/wallets/:id',
    name: 'wallet-detail',
    component: () => import('@/pages/WalletDetailPage.vue'),
    meta: { navKey: 'wallets' },
  },
  {
    path: '/categories',
    name: 'categories',
    component: () => import('@/pages/CategoriesPage.vue'),
    meta: { navKey: 'categories' },
  },
  {
    path: '/tags',
    name: 'tags',
    component: () => import('@/pages/TagsPage.vue'),
    meta: { navKey: 'tags' },
  },
  {
    path: '/stat',
    name: 'stat',
    component: () => import('@/pages/StatPage.vue'),
    meta: { navKey: 'stat' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/pages/SettingsPage.vue'),
    meta: { navKey: 'settings' },
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
