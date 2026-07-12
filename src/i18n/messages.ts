// Faz 2 sözlükleri. Faz 4'te finapp sözlükleri tam taşınacak.

export type LocaleCode = 'tr' | 'en' | 'ru'

export const messages = {
  tr: {
    app: { name: 'Weltoly' },
    nav: { dashboard: 'Panel', wallets: 'Cüzdanlar', categories: 'Kategoriler', stat: 'İstatistik', settings: 'Ayarlar', add: 'Ekle' },
    settings: {
      title: 'Ayarlar', appearance: 'Görünüm', theme: 'Tema',
      themeSystem: 'Sistem', themeLight: 'Açık', themeDark: 'Koyu', language: 'Dil',
      primaryColor: 'Ana renk', neutral: 'Nötr palet', radius: 'Köşe yuvarlaklığı', data: 'Veri', exportBackup: 'Yedeği dışa aktar', importBackup: 'Yedeği içe aktar',
      backupOk: 'Yedek kaydedildi', importOk: 'Yedek geri yüklendi', backupError: 'İşlem başarısız',
      loadDemo: 'Örnek veri yükle', clearData: 'Tüm veriyi sil', clearConfirm: 'Tüm cüzdan, kategori ve işlemler silinecek. Emin misin?',
      demoLoaded: 'Örnek veri yüklendi', dataCleared: 'Tüm veri silindi',
      profile: 'Profil ve güvenlik', displayName: 'Görünen ad', setPin: 'PIN belirle', changePin: 'PIN değiştir',
      removePin: 'PIN kaldır', pinRemoved: 'PIN kaldırıldı',
    },
    lock: { title: 'Kilitli', subtitle: 'PIN gir', enterNew: 'Yeni PIN gir', confirmNew: 'PIN tekrar gir', pinSet: 'PIN ayarlandı' },
    a11y: { skipToContent: 'İçeriğe atla' },
    hotkeys: { title: 'Klavye kısayolları', newTrn: 'Yeni işlem', help: 'Kısayol yardımı' },
    common: {
      soon: 'Bu bölüm yakında (geliştirme aşamasında).',
      save: 'Kaydet', cancel: 'Vazgeç', delete: 'Sil', edit: 'Düzenle', add: 'Ekle', close: 'Kapat', required: 'Zorunlu alan',
    },
    dashboard: { title: 'Panel', totalBalance: 'Toplam bakiye', recentTrns: 'Son işlemler', noTrns: 'Henüz işlem yok' },
    stat: { day: 'Gün', week: 'Hafta', month: 'Ay', year: 'Yıl', balance: 'Bakiye', breakdown: 'Kategori kırılımı', noData: 'Bu aralıkta veri yok', filterWallets: 'Cüzdan filtresi' },
    wallets: {
      title: 'Cüzdanlar', add: 'Cüzdan ekle', edit: 'Cüzdanı düzenle', empty: 'Henüz cüzdan yok', emptyHint: 'İlk cüzdanını ekleyerek başla.',
      name: 'Ad', type: 'Tür', currency: 'Para birimi', color: 'Renk', creditLimit: 'Kredi limiti', description: 'Açıklama',
      archived: 'Arşivlenmiş', excludeInTotal: 'Toplamdan hariç tut', withdrawal: 'Çekilebilir',
      deleteConfirm: 'Bu cüzdanı ve işlemlerini silmek istediğine emin misin?', total: 'Toplam',
      types: { cash: 'Nakit', credit: 'Kredi kartı', cashless: 'Banka hesabı', deposit: 'Mevduat', crypto: 'Kripto', debt: 'Borç' },
      errors: { saveFailed: 'Cüzdan kaydedilemedi', orderFailed: 'Sıralama kaydedilemedi', deleteFailed: 'Cüzdan silinemedi' },
    },
    categories: {
      title: 'Kategoriler', add: 'Kategori ekle', edit: 'Kategoriyi düzenle', empty: 'Henüz kategori yok', emptyHint: 'İlk kategorini ekleyerek başla.',
      name: 'Ad', icon: 'İkon', color: 'Renk', parent: 'Üst kategori', noParent: 'Yok (kök)',
      showInLastUsed: 'Son kullanılanlarda göster', showInQuickSelector: 'Hızlı seçicide göster (favori)',
      pickIcon: 'İkon seç', deleteConfirm: 'Bu kategoriyi ve işlemlerini silmek istediğine emin misin?',
      errors: { saveFailed: 'Kategori kaydedilemedi', deleteFailed: 'Kategori silinemedi' },
    },
    trns: {
      empty: 'Henüz işlem yok', today: 'Bugün', yesterday: 'Dün',
      errors: { saveFailed: 'İşlem kaydedilemedi', deleteFailed: 'İşlem silinemedi' },
    },
    trnForm: {
      newTitle: 'Yeni işlem', editTitle: 'İşlemi düzenle',
      expense: 'Gider', income: 'Gelir', transfer: 'Transfer',
      from: 'Gönderen', to: 'Alan', category: 'Kategori', wallet: 'Cüzdan', amount: 'Tutar', date: 'Tarih', description: 'Açıklama',
      noWallets: 'Önce bir cüzdan ekle', noCategories: 'Önce bir kategori ekle',
      errors: {
        selectWallet: 'Cüzdan seç', selectCategory: 'Kategori seç', amountEmpty: 'Tutar gir',
        transferAmountEmpty: 'Transfer tutarı gir', transferSameWallet: 'Farklı cüzdanlar seç', noData: 'Eksik bilgi',
      },
    },
  },

  en: {
    app: { name: 'Weltoly' },
    nav: { dashboard: 'Dashboard', wallets: 'Wallets', categories: 'Categories', stat: 'Stats', settings: 'Settings', add: 'Add' },
    settings: {
      title: 'Settings', appearance: 'Appearance', theme: 'Theme',
      themeSystem: 'System', themeLight: 'Light', themeDark: 'Dark', language: 'Language',
      primaryColor: 'Accent color', neutral: 'Neutral palette', radius: 'Corner radius', data: 'Data', exportBackup: 'Export backup', importBackup: 'Import backup',
      backupOk: 'Backup saved', importOk: 'Backup restored', backupError: 'Operation failed',
      loadDemo: 'Load sample data', clearData: 'Clear all data', clearConfirm: 'All wallets, categories and transactions will be deleted. Are you sure?',
      demoLoaded: 'Sample data loaded', dataCleared: 'All data cleared',
      profile: 'Profile & security', displayName: 'Display name', setPin: 'Set PIN', changePin: 'Change PIN',
      removePin: 'Remove PIN', pinRemoved: 'PIN removed',
    },
    lock: { title: 'Locked', subtitle: 'Enter PIN', enterNew: 'Enter new PIN', confirmNew: 'Re-enter PIN', pinSet: 'PIN set' },
    a11y: { skipToContent: 'Skip to content' },
    hotkeys: { title: 'Keyboard shortcuts', newTrn: 'New transaction', help: 'Shortcut help' },
    common: {
      soon: 'This section is coming soon (under development).',
      save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', add: 'Add', close: 'Close', required: 'Required',
    },
    dashboard: { title: 'Dashboard', totalBalance: 'Total balance', recentTrns: 'Recent transactions', noTrns: 'No transactions yet' },
    stat: { day: 'Day', week: 'Week', month: 'Month', year: 'Year', balance: 'Balance', breakdown: 'Breakdown', noData: 'No data for this range', filterWallets: 'Filter by wallet' },
    wallets: {
      title: 'Wallets', add: 'Add wallet', edit: 'Edit wallet', empty: 'No wallets yet', emptyHint: 'Start by adding your first wallet.',
      name: 'Name', type: 'Type', currency: 'Currency', color: 'Color', creditLimit: 'Credit limit', description: 'Description',
      archived: 'Archived', excludeInTotal: 'Exclude from total', withdrawal: 'Withdrawable',
      deleteConfirm: 'Delete this wallet and its transactions?', total: 'Total',
      types: { cash: 'Cash', credit: 'Credit card', cashless: 'Bank account', deposit: 'Deposit', crypto: 'Crypto', debt: 'Debt' },
      errors: { saveFailed: 'Failed to save wallet', orderFailed: 'Failed to save order', deleteFailed: 'Failed to delete wallet' },
    },
    categories: {
      title: 'Categories', add: 'Add category', edit: 'Edit category', empty: 'No categories yet', emptyHint: 'Start by adding your first category.',
      name: 'Name', icon: 'Icon', color: 'Color', parent: 'Parent category', noParent: 'None (root)',
      showInLastUsed: 'Show in recently used', showInQuickSelector: 'Show in quick selector (favorite)',
      pickIcon: 'Pick icon', deleteConfirm: 'Delete this category and its transactions?',
      errors: { saveFailed: 'Failed to save category', deleteFailed: 'Failed to delete category' },
    },
    trns: {
      empty: 'No transactions yet', today: 'Today', yesterday: 'Yesterday',
      errors: { saveFailed: 'Failed to save transaction', deleteFailed: 'Failed to delete transaction' },
    },
    trnForm: {
      newTitle: 'New transaction', editTitle: 'Edit transaction',
      expense: 'Expense', income: 'Income', transfer: 'Transfer',
      from: 'From', to: 'To', category: 'Category', wallet: 'Wallet', amount: 'Amount', date: 'Date', description: 'Description',
      noWallets: 'Add a wallet first', noCategories: 'Add a category first',
      errors: {
        selectWallet: 'Select a wallet', selectCategory: 'Select a category', amountEmpty: 'Enter an amount',
        transferAmountEmpty: 'Enter transfer amount', transferSameWallet: 'Select different wallets', noData: 'Missing data',
      },
    },
  },

  ru: {
    app: { name: 'Weltoly' },
    nav: { dashboard: 'Панель', wallets: 'Кошельки', categories: 'Категории', stat: 'Статистика', settings: 'Настройки', add: 'Добавить' },
    settings: {
      title: 'Настройки', appearance: 'Внешний вид', theme: 'Тема',
      themeSystem: 'Система', themeLight: 'Светлая', themeDark: 'Тёмная', language: 'Язык',
      primaryColor: 'Акцентный цвет', neutral: 'Нейтральная палитра', radius: 'Скругление углов', data: 'Данные', exportBackup: 'Экспорт резервной копии', importBackup: 'Импорт резервной копии',
      backupOk: 'Копия сохранена', importOk: 'Копия восстановлена', backupError: 'Ошибка операции',
      loadDemo: 'Загрузить пример', clearData: 'Очистить все данные', clearConfirm: 'Все кошельки, категории и операции будут удалены. Вы уверены?',
      demoLoaded: 'Пример загружен', dataCleared: 'Все данные удалены',
      profile: 'Профиль и безопасность', displayName: 'Отображаемое имя', setPin: 'Задать PIN', changePin: 'Изменить PIN',
      removePin: 'Удалить PIN', pinRemoved: 'PIN удалён',
    },
    lock: { title: 'Заблокировано', subtitle: 'Введите PIN', enterNew: 'Новый PIN', confirmNew: 'Повторите PIN', pinSet: 'PIN задан' },
    a11y: { skipToContent: 'Перейти к содержимому' },
    hotkeys: { title: 'Горячие клавиши', newTrn: 'Новая операция', help: 'Справка по клавишам' },
    common: {
      soon: 'Этот раздел скоро появится (в разработке).',
      save: 'Сохранить', cancel: 'Отмена', delete: 'Удалить', edit: 'Изменить', add: 'Добавить', close: 'Закрыть', required: 'Обязательное поле',
    },
    dashboard: { title: 'Панель', totalBalance: 'Общий баланс', recentTrns: 'Последние операции', noTrns: 'Пока нет операций' },
    stat: { day: 'День', week: 'Неделя', month: 'Месяц', year: 'Год', balance: 'Баланс', breakdown: 'Разбивка', noData: 'Нет данных за период', filterWallets: 'Фильтр по кошельку' },
    wallets: {
      title: 'Кошельки', add: 'Добавить кошелёк', edit: 'Изменить кошелёк', empty: 'Пока нет кошельков', emptyHint: 'Начните с добавления первого кошелька.',
      name: 'Название', type: 'Тип', currency: 'Валюта', color: 'Цвет', creditLimit: 'Кредитный лимит', description: 'Описание',
      archived: 'В архиве', excludeInTotal: 'Исключить из общего', withdrawal: 'Доступно к снятию',
      deleteConfirm: 'Удалить этот кошелёк и его операции?', total: 'Итого',
      types: { cash: 'Наличные', credit: 'Кредитная карта', cashless: 'Банковский счёт', deposit: 'Депозит', crypto: 'Криптовалюта', debt: 'Долг' },
      errors: { saveFailed: 'Не удалось сохранить кошелёк', orderFailed: 'Не удалось сохранить порядок', deleteFailed: 'Не удалось удалить кошелёк' },
    },
    categories: {
      title: 'Категории', add: 'Добавить категорию', edit: 'Изменить категорию', empty: 'Пока нет категорий', emptyHint: 'Начните с добавления первой категории.',
      name: 'Название', icon: 'Иконка', color: 'Цвет', parent: 'Родительская категория', noParent: 'Нет (корень)',
      showInLastUsed: 'Показывать в недавних', showInQuickSelector: 'Показывать в быстром выборе (избранное)',
      pickIcon: 'Выбрать иконку', deleteConfirm: 'Удалить эту категорию и её операции?',
      errors: { saveFailed: 'Не удалось сохранить категорию', deleteFailed: 'Не удалось удалить категорию' },
    },
    trns: {
      empty: 'Пока нет операций', today: 'Сегодня', yesterday: 'Вчера',
      errors: { saveFailed: 'Не удалось сохранить операцию', deleteFailed: 'Не удалось удалить операцию' },
    },
    trnForm: {
      newTitle: 'Новая операция', editTitle: 'Изменить операцию',
      expense: 'Расход', income: 'Доход', transfer: 'Перевод',
      from: 'Откуда', to: 'Куда', category: 'Категория', wallet: 'Кошелёк', amount: 'Сумма', date: 'Дата', description: 'Описание',
      noWallets: 'Сначала добавьте кошелёк', noCategories: 'Сначала добавьте категорию',
      errors: {
        selectWallet: 'Выберите кошелёк', selectCategory: 'Выберите категорию', amountEmpty: 'Введите сумму',
        transferAmountEmpty: 'Введите сумму перевода', transferSameWallet: 'Выберите разные кошельки', noData: 'Недостаточно данных',
      },
    },
  },
}
