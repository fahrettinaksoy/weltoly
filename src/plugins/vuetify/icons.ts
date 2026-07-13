import { aliases as mdiAliases, mdi } from 'vuetify/iconsets/mdi'

// icon-fonts: MDI font seti (CSS index.ts'te import edilir).
// Enterprise: semantik ikon alias'ları — ikonlar tek yerden yönetilir, `$navWallets` gibi kullanılır.
export const icons = {
  defaultSet: 'mdi',
  aliases: {
    ...mdiAliases,
    // Uygulama-özel semantik alias'lar (tek kaynak; değiştirmek için tek yer)
    navDashboard: 'mdi-view-dashboard-outline',
    navWallets: 'mdi-wallet-outline',
    navCategories: 'mdi-shape-outline',
    navTags: 'mdi-tag-multiple-outline',
    navStat: 'mdi-chart-box-outline',
    navSettings: 'mdi-cog-outline',
    add: 'mdi-plus',
    addCircle: 'mdi-plus-circle',
    transfer: 'mdi-swap-horizontal',
    income: 'mdi-arrow-down',
    expense: 'mdi-arrow-up',
    lock: 'mdi-lock-outline',
    search: 'mdi-magnify',
  },
  sets: { mdi },
}
