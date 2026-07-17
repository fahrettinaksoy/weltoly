// Tablo/kolon allow-list'i — TEK KAYNAK.
//
// Neden burada: SQLite şemasındaki kolon adları birden çok yerde SQL metnine
// GÖMÜLÜR (buildUpsert, importBackup). Kolon adları asla parametrelenemez
// (identifier'lar bind edilemez), bu yüzden güvenlik tümüyle "ada göre beyaz liste"ye
// dayanır. Güvenilmeyen bir kaynaktan (ör. içe aktarılan yedek dosyası) gelen bir
// kolon adı, buradaki listeyle birebir eşleşmiyorsa SQL'e HİÇ girmemelidir.
//
// Şema değişince (yeni migration) bu listeyi de güncelle — testler senkron tutar.

export const TABLE_COLUMNS = {
  categories: [
    'id',
    'color',
    'icon',
    'name',
    'parentId',
    'showInLastUsed',
    'showInQuickSelector',
    'updatedAt',
    'userId',
    'desc',
  ],
  wallets: [
    'id',
    'color',
    'creditLimit',
    'currency',
    'desc',
    'isArchived',
    'isExcludeInTotal',
    'isWithdrawal',
    'name',
    'order',
    'type',
    'updatedAt',
    'userId',
    'icon',
  ],
  trns: [
    'id',
    'amount',
    'categoryId',
    'date',
    'desc',
    'expenseAmount',
    'expenseWalletId',
    'incomeAmount',
    'incomeWalletId',
    'type',
    'updatedAt',
    'userId',
    'walletId',
    'tagIds',
  ],
  tags: ['id', 'name', 'color', 'updatedAt', 'userId', 'desc'],
  user_settings: ['id', 'baseCurrency', 'locale', 'userId', 'defaultWalletId', 'rateSource'],
  rates: ['id', 'date', 'rates', 'source', 'updatedAt', 'rateDate'],
} as const

export type TableName = keyof typeof TABLE_COLUMNS

/** Yedeğe/geri-yüklemeye dahil edilecek tablolar (outbox hariç: türetilir). */
export const BACKUP_TABLES = Object.keys(TABLE_COLUMNS) as TableName[]

/** Yazılabilir tablo mu? (mutations.assertTable ile aynı küme.) */
export function isKnownTable(t: string): t is TableName {
  return Object.prototype.hasOwnProperty.call(TABLE_COLUMNS, t)
}

/**
 * Bir tablonun beyaz listesindeki kolon mu? Güvenilmeyen JSON anahtarları buradan
 * geçmeden ASLA SQL identifier'ına dönüştürülemez. Ekstra savunma olarak sadece
 * `[A-Za-z0-9_]` karakterlerine izin ver (liste zaten güvenli ama katmanlı savunma).
 */
export function isKnownColumn(table: TableName, col: string): boolean {
  if (!/^\w+$/.test(col))
    return false
  return (TABLE_COLUMNS[table] as readonly string[]).includes(col)
}
