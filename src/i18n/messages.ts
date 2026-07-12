// Faz 0 sözlükleri - kabuk/navigasyon için minimal.
// Faz 4'te finapp sözlükleri taşınacak (tr/en/ru genişletilecek).

export type LocaleCode = 'tr' | 'en' | 'ru'

export const messages = {
  tr: {
    app: { name: 'Weltoly' },
    nav: {
      dashboard: 'Panel',
      wallets: 'Cüzdanlar',
      categories: 'Kategoriler',
      stat: 'İstatistik',
      settings: 'Ayarlar',
      add: 'Ekle',
    },
    settings: {
      title: 'Ayarlar',
      appearance: 'Görünüm',
      theme: 'Tema',
      themeSystem: 'Sistem',
      themeLight: 'Açık',
      themeDark: 'Koyu',
      language: 'Dil',
    },
    common: {
      soon: 'Bu bölüm yakında (geliştirme aşamasında).',
    },
  },
  en: {
    app: { name: 'Weltoly' },
    nav: {
      dashboard: 'Dashboard',
      wallets: 'Wallets',
      categories: 'Categories',
      stat: 'Stats',
      settings: 'Settings',
      add: 'Add',
    },
    settings: {
      title: 'Settings',
      appearance: 'Appearance',
      theme: 'Theme',
      themeSystem: 'System',
      themeLight: 'Light',
      themeDark: 'Dark',
      language: 'Language',
    },
    common: {
      soon: 'This section is coming soon (under development).',
    },
  },
  ru: {
    app: { name: 'Weltoly' },
    nav: {
      dashboard: 'Панель',
      wallets: 'Кошельки',
      categories: 'Категории',
      stat: 'Статистика',
      settings: 'Настройки',
      add: 'Добавить',
    },
    settings: {
      title: 'Настройки',
      appearance: 'Внешний вид',
      theme: 'Тема',
      themeSystem: 'Система',
      themeLight: 'Светлая',
      themeDark: 'Тёмная',
      language: 'Язык',
    },
    common: {
      soon: 'Этот раздел скоро появится (в разработке).',
    },
  },
}
