import type { CategoryItem } from '@/features/categories/types'
import type { TagItem } from '@/features/tags/types'
import type { TrnItem } from '@/features/trns/types'
import type { WalletItem } from '@/features/wallets/types'
import { TrnType } from '@/features/trns/types'
import {
  categoryToRow,
  emitTableChange,
  getDb,
  isTauriRuntime,
  resolveWriteUid,
  tagToRow,
  trnToRow,
  upsertRow,
  walletToRow
} from '@/services/db'

const uid = resolveWriteUid(null)
const DAY = 86_400_000

interface WalletSeed {
  name: string
  type: WalletItem['type']
  currency: string
  color: string
  order: number
  icon?: string
  desc?: string
  creditLimit?: number
  isWithdrawal?: boolean
  isExcludeInTotal?: boolean
  isArchived?: boolean
}

function base(p: WalletSeed): WalletItem {
  const item = {
    name: p.name,
    type: p.type as Exclude<WalletItem['type'], 'credit'>,
    currency: p.currency,
    color: p.color,
    icon: p.icon ?? '',
    desc: p.desc ?? '',
    isArchived: p.isArchived ?? false,
    isExcludeInTotal: p.isExcludeInTotal ?? false,
    isWithdrawal: p.isWithdrawal ?? false,
    order: p.order,
    updatedAt: Date.now()
  }
  return (
    p.type === 'credit' ? { ...item, type: 'credit', creditLimit: p.creditLimit ?? 0 } : item
  ) as WalletItem
}

/**
 * Örnek cüzdanlar — sabit id'ler (yeniden yükleme çoğaltmaz, üzerine yazar).
 *
 * Cüzdan = paranın GERÇEKTEN durduğu hesap: banka hesabı, kart, borsa, kredi.
 * Bütçe zarfı ("tatil fonu", "çocuk birikimi") cüzdan DEĞİLDİR — o, kategori ve
 * etiketlerin işi. Bu yüzden hepsi gerçek kurum/hesap adı taşır.
 *
 * Açılış bakiyeleri buildTrns içinde 'adjustment' işlemiyle verilir (gelir/gider
 * toplamlarını kirletmemek için).
 */
export const wallets: { id: string; item: WalletItem; opening?: number }[] = [
  {
    id: 'demo-w-cash',
    opening: 3200,
    item: base({
      name: 'Cüzdan',
      type: 'cash',
      currency: 'TRY',
      color: '#22c55e',
      order: 0,
      icon: 'mdi-wallet',
      desc: 'Cepteki günlük nakit',
      isWithdrawal: true
    })
  },
  {
    id: 'demo-w-cash-usd',
    opening: 850,
    item: base({
      name: 'Nakit Döviz',
      type: 'cash',
      currency: 'USD',
      color: '#16a34a',
      order: 1,
      icon: 'mdi-cash',
      desc: 'Evde tutulan döviz nakit'
    })
  },
  {
    id: 'demo-w-ziraat',
    opening: 42500,
    item: base({
      name: 'Ziraat Vadesiz',
      type: 'cashless',
      currency: 'TRY',
      color: '#1d4ed8',
      order: 2,
      icon: 'mdi-bank',
      desc: 'Maaşın yattığı ana hesap',
      isWithdrawal: true
    })
  },
  {
    id: 'demo-w-isbank',
    opening: 8400,
    item: base({
      name: 'İş Bankası Vadesiz',
      type: 'cashless',
      currency: 'TRY',
      color: '#2563eb',
      order: 3,
      icon: 'mdi-bank-outline',
      desc: 'Fatura ve otomatik ödemeler',
      isWithdrawal: true
    })
  },
  {
    id: 'demo-w-garanti',
    opening: 6800,
    item: base({
      name: 'Garanti BBVA Vadesiz',
      type: 'cashless',
      currency: 'TRY',
      color: '#3b82f6',
      order: 4,
      icon: 'mdi-bank',
      desc: 'Günlük harcamalar için vadesiz hesap',
      isWithdrawal: true
    })
  },
  {
    id: 'demo-w-yapikredi',
    opening: 2100,
    item: base({
      name: 'Yapı Kredi Vadesiz',
      type: 'cashless',
      currency: 'TRY',
      color: '#60a5fa',
      order: 5,
      icon: 'mdi-bank-outline',
      desc: 'Kredi kartı ekstre ödemeleri'
    })
  },
  {
    id: 'demo-w-akbank',
    opening: 1450,
    item: base({
      name: 'Akbank Vadesiz',
      type: 'cashless',
      currency: 'TRY',
      color: '#0ea5e9',
      order: 6,
      icon: 'mdi-bank',
      desc: 'İkincil banka hesabı'
    })
  },
  {
    id: 'demo-w-enpara',
    opening: 12300,
    item: base({
      name: 'Enpara',
      type: 'cashless',
      currency: 'TRY',
      color: '#7c3aed',
      order: 7,
      icon: 'mdi-cellphone-nfc',
      desc: 'Dijital banka — masrafsız hesap',
      isWithdrawal: true
    })
  },
  {
    id: 'demo-w-papara',
    opening: 640,
    item: base({
      name: 'Papara',
      type: 'cashless',
      currency: 'TRY',
      color: '#a855f7',
      order: 8,
      icon: 'mdi-lightning-bolt',
      desc: 'Online ödemeler ve küçük transferler',
      isWithdrawal: true
    })
  },
  {
    id: 'demo-w-joint',
    opening: 9400,
    item: base({
      name: 'Garanti Ortak Hesap',
      type: 'cashless',
      currency: 'TRY',
      color: '#6366f1',
      order: 9,
      icon: 'mdi-account-multiple',
      desc: 'Ev giderleri için eşle ortak hesap'
    })
  },
  {
    id: 'demo-w-business',
    opening: 18300,
    item: base({
      name: 'İş Bankası Ticari',
      type: 'cashless',
      currency: 'TRY',
      color: '#4f46e5',
      order: 10,
      icon: 'mdi-briefcase-outline',
      desc: 'Serbest çalışma gelirlerinin toplandığı hesap',
      isExcludeInTotal: true
    })
  },
  {
    id: 'demo-w-usd-acc',
    opening: 2100,
    item: base({
      name: 'Garanti USD Hesabı',
      type: 'cashless',
      currency: 'USD',
      color: '#0891b2',
      order: 11,
      icon: 'mdi-currency-usd',
      desc: 'Dolar mevduatı'
    })
  },
  {
    id: 'demo-w-eur-acc',
    opening: 3200,
    item: base({
      name: 'İş Bankası EUR Hesabı',
      type: 'cashless',
      currency: 'EUR',
      color: '#06b6d4',
      order: 12,
      icon: 'mdi-currency-eur',
      desc: 'Euro mevduatı'
    })
  },
  {
    id: 'demo-w-wise',
    opening: 750,
    item: base({
      name: 'Wise',
      type: 'cashless',
      currency: 'GBP',
      color: '#14b8a6',
      order: 13,
      icon: 'mdi-earth',
      desc: 'Yurt dışı ödemeler için çoklu para hesabı',
      isWithdrawal: true
    })
  },
  {
    id: 'demo-w-paypal',
    opening: 320,
    item: base({
      name: 'PayPal',
      type: 'cashless',
      currency: 'USD',
      color: '#2dd4bf',
      order: 14,
      icon: 'mdi-credit-card-wireless',
      desc: 'Online abonelik ve yurt dışı alışveriş'
    })
  },
  {
    id: 'demo-w-revolut',
    opening: 480,
    item: base({
      name: 'Revolut',
      type: 'cashless',
      currency: 'EUR',
      color: '#38bdf8',
      order: 15,
      icon: 'mdi-earth',
      desc: 'Seyahatte kullanılan çoklu para kartı',
      isWithdrawal: true
    })
  },
  {
    id: 'demo-w-td32',
    opening: 60000,
    item: base({
      name: 'Ziraat 32 Gün Vadeli',
      type: 'deposit',
      currency: 'TRY',
      color: '#0d9488',
      order: 16,
      icon: 'mdi-piggy-bank-outline',
      desc: 'Aylık yenilenen vadeli mevduat'
    })
  },
  {
    id: 'demo-w-td-garanti',
    opening: 35000,
    item: base({
      name: 'Garanti Vadeli Mevduat',
      type: 'deposit',
      currency: 'TRY',
      color: '#0f766e',
      order: 17,
      icon: 'mdi-safe-square-outline',
      desc: '3 ay vadeli mevduat hesabı'
    })
  },
  {
    id: 'demo-w-gold',
    opening: 24500,
    item: base({
      name: 'İş Bankası Altın Hesabı',
      type: 'deposit',
      currency: 'TRY',
      color: '#eab308',
      order: 18,
      icon: 'mdi-gold',
      desc: 'Gram altın biriktirme hesabı'
    })
  },
  {
    id: 'demo-w-enpara-save',
    opening: 18000,
    item: base({
      name: 'Enpara Birikim',
      type: 'deposit',
      currency: 'TRY',
      color: '#84cc16',
      order: 19,
      icon: 'mdi-piggy-bank-outline',
      desc: 'Günlük faizli birikim hesabı'
    })
  },
  {
    id: 'demo-w-bonus',
    opening: -4300,
    item: base({
      name: 'Garanti Bonus',
      type: 'credit',
      currency: 'TRY',
      color: '#a855f7',
      order: 20,
      icon: 'mdi-credit-card-outline',
      desc: 'Market ve akaryakıt harcamaları',
      creditLimit: 30000
    })
  },
  {
    id: 'demo-w-world',
    opening: -2750,
    item: base({
      name: 'Yapı Kredi World',
      type: 'credit',
      currency: 'TRY',
      color: '#c026d3',
      order: 21,
      icon: 'mdi-credit-card',
      desc: 'Günlük harcamalar ve puan biriktirme',
      creditLimit: 25000
    })
  },
  {
    id: 'demo-w-maximum',
    opening: -11200,
    item: base({
      name: 'İş Bankası Maximum',
      type: 'credit',
      currency: 'TRY',
      color: '#d946ef',
      order: 22,
      icon: 'mdi-credit-card-multiple',
      desc: 'Taksitli alışverişler için',
      creditLimit: 40000
    })
  },
  {
    id: 'demo-w-cardfinans',
    opening: -1850,
    item: base({
      name: 'QNB CardFinans',
      type: 'credit',
      currency: 'TRY',
      color: '#e879f9',
      order: 23,
      icon: 'mdi-credit-card-chip',
      desc: 'Yedek kart',
      creditLimit: 20000
    })
  },
  {
    id: 'demo-w-axess',
    opening: 0,
    item: base({
      name: 'Akbank Axess',
      type: 'credit',
      currency: 'TRY',
      color: '#f0abfc',
      order: 24,
      icon: 'mdi-credit-card-settings',
      desc: 'Kapatılmış kart — kayıt için tutuluyor',
      creditLimit: 15000,
      isArchived: true
    })
  },
  {
    id: 'demo-w-amex',
    opening: -320,
    item: base({
      name: 'Amex Green',
      type: 'credit',
      currency: 'USD',
      color: '#ec4899',
      order: 25,
      icon: 'mdi-credit-card',
      desc: 'Yurt dışı online ödemeler',
      creditLimit: 5000
    })
  },
  {
    id: 'demo-w-broker',
    opening: 5600,
    item: base({
      name: 'Midas',
      type: 'cashless',
      currency: 'USD',
      color: '#7c3aed',
      order: 26,
      icon: 'mdi-chart-line',
      desc: 'ABD hisse senedi yatırım hesabı'
    })
  },
  {
    id: 'demo-w-isyatirim',
    opening: 22000,
    item: base({
      name: 'İş Yatırım',
      type: 'cashless',
      currency: 'TRY',
      color: '#8b5cf6',
      order: 27,
      icon: 'mdi-finance',
      desc: 'BIST hisse ve yatırım fonu hesabı'
    })
  },
  {
    id: 'demo-w-binance',
    opening: 1800,
    item: base({
      name: 'Binance',
      type: 'crypto',
      currency: 'USDT',
      color: '#facc15',
      order: 28,
      icon: 'mdi-swap-horizontal-bold',
      desc: 'Borsa hesabı — alım satım',
      isWithdrawal: true
    })
  },
  {
    id: 'demo-w-btcturk',
    opening: 4200,
    item: base({
      name: 'BtcTurk',
      type: 'crypto',
      currency: 'TRY',
      color: '#f59e0b',
      order: 29,
      icon: 'mdi-swap-horizontal-bold',
      desc: 'TL ile kripto alım satım'
    })
  },
  {
    id: 'demo-w-paribu',
    opening: 1100,
    item: base({
      name: 'Paribu',
      type: 'crypto',
      currency: 'TRY',
      color: '#fbbf24',
      order: 30,
      icon: 'mdi-swap-horizontal-bold',
      desc: 'İkincil kripto borsası'
    })
  },
  {
    id: 'demo-w-ledger',
    opening: 0.42,
    item: base({
      name: 'Ledger Nano',
      type: 'crypto',
      currency: 'BTC',
      color: '#64748b',
      order: 31,
      icon: 'mdi-usb-flash-drive',
      desc: 'Donanım (soğuk) cüzdan — uzun vadeli BTC'
    })
  },
  {
    id: 'demo-w-metamask',
    opening: 3.15,
    item: base({
      name: 'MetaMask',
      type: 'crypto',
      currency: 'ETH',
      color: '#6366f1',
      order: 32,
      icon: 'mdi-ethereum',
      desc: 'ETH ve DeFi işlemleri'
    })
  },
  {
    id: 'demo-w-mortgage',
    opening: -420000,
    item: base({
      name: 'Ziraat Konut Kredisi',
      type: 'debt',
      currency: 'TRY',
      color: '#dc2626',
      order: 33,
      icon: 'mdi-home-city-outline',
      desc: 'Kalan konut kredisi borcu'
    })
  },
  {
    id: 'demo-w-car-loan',
    opening: -68000,
    item: base({
      name: 'Garanti Taşıt Kredisi',
      type: 'debt',
      currency: 'TRY',
      color: '#ef4444',
      order: 34,
      icon: 'mdi-car-back',
      desc: 'Araç kredisi — 18 taksit kaldı'
    })
  },
  {
    id: 'demo-w-loan',
    opening: -15400,
    item: base({
      name: 'İş Bankası İhtiyaç Kredisi',
      type: 'debt',
      currency: 'TRY',
      color: '#b91c1c',
      order: 35,
      icon: 'mdi-bank-transfer-out',
      desc: 'Kalan ihtiyaç kredisi taksitleri'
    })
  }
]

function cat(
  name: string,
  icon: string,
  color: string,
  parentId: string | 0 = 0,
  fav = false,
  desc = ''
): CategoryItem {
  return {
    name,
    desc,
    icon,
    color,
    parentId,
    showInLastUsed: true,
    showInQuickSelector: fav,
    updatedAt: Date.now()
  }
}

/**
 * Kişisel bütçe kategorileri — "para NE İÇİN harcandı" (tek seçim, birbirini dışlar).
 * Etiketlerle kasıtlı olarak ÇAKIŞMAZ: etiketler "hangi bağlamda / nasıl" sorusunu
 * yanıtlar (çoklu seçim, kesişir). Bu yüzden Market/Kira/Yakıt gibi kalemler yalnız
 * burada; Zorunlu/Aylık/Nakit gibi nitelikler yalnız etiketlerde.
 */
export const categories: { id: string; item: CategoryItem }[] = [
  {
    id: 'demo-c-income',
    item: cat('Gelir', 'mdi-cash-plus', '#22c55e', 0, true, 'Tüm gelir kalemleri')
  },
  {
    id: 'demo-c-salary',
    item: cat(
      'Maaş',
      'mdi-cash-multiple',
      '#22c55e',
      'demo-c-income',
      false,
      'Aylık net maaş girişi'
    )
  },
  {
    id: 'demo-c-freelance',
    item: cat(
      'Serbest Çalışma',
      'mdi-laptop',
      '#22c55e',
      'demo-c-income',
      false,
      'Proje ve danışmanlık gelirleri'
    )
  },
  {
    id: 'demo-c-rent-income',
    item: cat(
      'Kira Geliri',
      'mdi-home-city',
      '#22c55e',
      'demo-c-income',
      false,
      'Sahip olunan gayrimenkulden kira'
    )
  },
  {
    id: 'demo-c-invest-income',
    item: cat(
      'Yatırım Getirisi',
      'mdi-trending-up',
      '#22c55e',
      'demo-c-income',
      false,
      'Temettü, faiz ve değer artışı'
    )
  },
  {
    id: 'demo-c-bonus',
    item: cat(
      'Prim & İkramiye',
      'mdi-gift-open',
      '#22c55e',
      'demo-c-income',
      false,
      'Performans primi ve ikramiyeler'
    )
  },
  {
    id: 'demo-c-refund',
    item: cat(
      'İade & Geri Ödeme',
      'mdi-cash-refund',
      '#22c55e',
      'demo-c-income',
      false,
      'Geri alınan ödemeler ve iadeler'
    )
  },
  {
    id: 'demo-c-housing',
    item: cat('Konut', 'mdi-home', '#64748b', 0, false, 'Oturulan evle ilgili tüm giderler')
  },
  {
    id: 'demo-c-rent',
    item: cat(
      'Kira Ödemesi',
      'mdi-home-city-outline',
      '#64748b',
      'demo-c-housing',
      false,
      'Her ayın başında ödenen kira'
    )
  },
  {
    id: 'demo-c-dues',
    item: cat(
      'Aidat',
      'mdi-office-building',
      '#64748b',
      'demo-c-housing',
      false,
      'Site/apartman aidatı'
    )
  },
  {
    id: 'demo-c-mortgage',
    item: cat(
      'Konut Kredisi',
      'mdi-bank',
      '#64748b',
      'demo-c-housing',
      false,
      'Konut kredisi taksiti'
    )
  },
  {
    id: 'demo-c-repair',
    item: cat(
      'Ev Onarım',
      'mdi-hammer-wrench',
      '#64748b',
      'demo-c-housing',
      false,
      'Tadilat, tesisat ve küçük onarımlar'
    )
  },
  {
    id: 'demo-c-furniture',
    item: cat(
      'Mobilya & Beyaz Eşya',
      'mdi-sofa',
      '#64748b',
      'demo-c-housing',
      false,
      'Ev eşyası alımı ve yenileme'
    )
  },
  {
    id: 'demo-c-home-insurance',
    item: cat(
      'Konut Sigortası',
      'mdi-shield-home',
      '#64748b',
      'demo-c-housing',
      false,
      'DASK ve konut sigorta primi'
    )
  },
  {
    id: 'demo-c-bills',
    item: cat(
      'Faturalar',
      'mdi-file-document',
      '#eab308',
      0,
      false,
      'Düzenli tekrarlayan abonelik ve faturalar'
    )
  },
  {
    id: 'demo-c-electric',
    item: cat('Elektrik', 'mdi-flash', '#eab308', 'demo-c-bills', false, 'Aylık elektrik faturası')
  },
  {
    id: 'demo-c-water',
    item: cat('Su', 'mdi-water', '#eab308', 'demo-c-bills', false, 'Aylık su faturası')
  },
  {
    id: 'demo-c-gas',
    item: cat(
      'Doğalgaz',
      'mdi-fire',
      '#eab308',
      'demo-c-bills',
      false,
      'Isınma ve doğalgaz faturası'
    )
  },
  {
    id: 'demo-c-internet',
    item: cat('İnternet', 'mdi-wifi', '#eab308', 'demo-c-bills', false, 'Ev interneti aboneliği')
  },
  {
    id: 'demo-c-phone',
    item: cat(
      'Telefon',
      'mdi-cellphone',
      '#eab308',
      'demo-c-bills',
      false,
      'Hat ücreti ve mobil paket'
    )
  },
  {
    id: 'demo-c-streaming',
    item: cat(
      'Dijital Yayın',
      'mdi-television-play',
      '#eab308',
      'demo-c-bills',
      false,
      'Film, dizi ve müzik platformları'
    )
  },
  {
    id: 'demo-c-grocery',
    item: cat('Market', 'mdi-cart', '#84cc16', 0, true, 'Evde tüketilen gıda ve temel ihtiyaçlar')
  },
  {
    id: 'demo-c-market',
    item: cat(
      'Market Alışverişi',
      'mdi-cart-outline',
      '#84cc16',
      'demo-c-grocery',
      false,
      'Haftalık market alışverişi'
    )
  },
  {
    id: 'demo-c-butcher',
    item: cat(
      'Manav & Kasap',
      'mdi-food-drumstick',
      '#84cc16',
      'demo-c-grocery',
      false,
      'Taze sebze, meyve ve et'
    )
  },
  {
    id: 'demo-c-bakery',
    item: cat(
      'Fırın & Şarküteri',
      'mdi-bread-slice',
      '#84cc16',
      'demo-c-grocery',
      false,
      'Ekmek, pastane ve şarküteri'
    )
  },
  {
    id: 'demo-c-dining',
    item: cat(
      'Yeme & İçme',
      'mdi-silverware-fork-knife',
      '#f97316',
      0,
      true,
      'Dışarıda tüketilen yiyecek ve içecek'
    )
  },
  {
    id: 'demo-c-restaurant',
    item: cat(
      'Restoran',
      'mdi-silverware-variant',
      '#f97316',
      'demo-c-dining',
      false,
      'Dışarıda yenen öğünler'
    )
  },
  {
    id: 'demo-c-cafe',
    item: cat(
      'Kafe & Kahve',
      'mdi-coffee',
      '#f97316',
      'demo-c-dining',
      false,
      'Kahve ve atıştırmalık molaları'
    )
  },
  {
    id: 'demo-c-delivery',
    item: cat(
      'Paket Servis',
      'mdi-moped',
      '#f97316',
      'demo-c-dining',
      false,
      'Eve sipariş edilen yemek'
    )
  },
  {
    id: 'demo-c-transport',
    item: cat('Ulaşım', 'mdi-car', '#0ea5e9', 0, true, 'Araç, toplu taşıma ve yolculuk giderleri')
  },
  {
    id: 'demo-c-fuel',
    item: cat(
      'Yakıt',
      'mdi-gas-station',
      '#0ea5e9',
      'demo-c-transport',
      false,
      'Benzin, motorin ve şarj'
    )
  },
  {
    id: 'demo-c-transit',
    item: cat(
      'Toplu Taşıma',
      'mdi-bus',
      '#0ea5e9',
      'demo-c-transport',
      false,
      'Otobüs, metro ve vapur'
    )
  },
  {
    id: 'demo-c-taxi',
    item: cat(
      'Taksi',
      'mdi-taxi',
      '#0ea5e9',
      'demo-c-transport',
      false,
      'Şehir içi kısa mesafe yolculuklar'
    )
  },
  {
    id: 'demo-c-parking',
    item: cat(
      'Otopark & Otoyol',
      'mdi-parking',
      '#0ea5e9',
      'demo-c-transport',
      false,
      'Otopark, köprü ve otoyol geçişleri'
    )
  },
  {
    id: 'demo-c-car-service',
    item: cat(
      'Araç Bakım',
      'mdi-car-wrench',
      '#0ea5e9',
      'demo-c-transport',
      false,
      'Periyodik bakım, lastik ve onarım'
    )
  },
  {
    id: 'demo-c-car-insurance',
    item: cat(
      'Araç Sigorta & Vergi',
      'mdi-shield-car',
      '#0ea5e9',
      'demo-c-transport',
      false,
      'Kasko, trafik sigortası ve MTV'
    )
  },
  {
    id: 'demo-c-car-loan',
    item: cat(
      'Taşıt Kredisi',
      'mdi-car-back',
      '#0ea5e9',
      'demo-c-transport',
      false,
      'Araç kredisi taksiti'
    )
  },
  {
    id: 'demo-c-health',
    item: cat('Sağlık', 'mdi-heart-pulse', '#10b981', 0, false, 'Tedavi, ilaç ve koruyucu sağlık')
  },
  {
    id: 'demo-c-doctor',
    item: cat(
      'Doktor & Muayene',
      'mdi-stethoscope',
      '#10b981',
      'demo-c-health',
      false,
      'Muayene ve tahlil ücretleri'
    )
  },
  {
    id: 'demo-c-pharmacy',
    item: cat(
      'İlaç & Eczane',
      'mdi-pill',
      '#10b981',
      'demo-c-health',
      false,
      'Reçeteli ve reçetesiz ilaçlar'
    )
  },
  {
    id: 'demo-c-dental',
    item: cat(
      'Diş',
      'mdi-tooth-outline',
      '#10b981',
      'demo-c-health',
      false,
      'Diş tedavisi ve kontrol'
    )
  },
  {
    id: 'demo-c-optic',
    item: cat(
      'Gözlük & Lens',
      'mdi-glasses',
      '#10b981',
      'demo-c-health',
      false,
      'Numaralı gözlük ve lens'
    )
  },
  {
    id: 'demo-c-health-insurance',
    item: cat(
      'Sağlık Sigortası',
      'mdi-shield-plus',
      '#10b981',
      'demo-c-health',
      false,
      'Tamamlayıcı sağlık sigortası primi'
    )
  },
  {
    id: 'demo-c-sport',
    item: cat('Spor', 'mdi-dumbbell', '#06b6d4', 0, false, 'Spor ve fiziksel aktivite')
  },
  {
    id: 'demo-c-gym',
    item: cat(
      'Salon Üyeliği',
      'mdi-weight-lifter',
      '#06b6d4',
      'demo-c-sport',
      false,
      'Spor salonu aylık üyeliği'
    )
  },
  {
    id: 'demo-c-sport-gear',
    item: cat(
      'Spor Ekipmanı',
      'mdi-basketball',
      '#06b6d4',
      'demo-c-sport',
      false,
      'Spor kıyafeti ve malzemesi'
    )
  },
  {
    id: 'demo-c-personal',
    item: cat(
      'Giyim & Bakım',
      'mdi-tshirt-crew',
      '#e11d48',
      0,
      false,
      'Giyim ve kişisel bakım harcamaları'
    )
  },
  {
    id: 'demo-c-clothing',
    item: cat(
      'Giyim & Ayakkabı',
      'mdi-shoe-sneaker',
      '#e11d48',
      'demo-c-personal',
      false,
      'Kıyafet ve ayakkabı alışverişi'
    )
  },
  {
    id: 'demo-c-hair',
    item: cat(
      'Kuaför & Berber',
      'mdi-content-cut',
      '#e11d48',
      'demo-c-personal',
      false,
      'Saç kesimi ve bakımı'
    )
  },
  {
    id: 'demo-c-cosmetics',
    item: cat(
      'Kozmetik',
      'mdi-lipstick',
      '#e11d48',
      'demo-c-personal',
      false,
      'Cilt bakımı ve kozmetik ürünler'
    )
  },
  {
    id: 'demo-c-education',
    item: cat('Eğitim', 'mdi-school', '#3b82f6', 0, false, 'Öğrenme ve gelişim harcamaları')
  },
  {
    id: 'demo-c-course',
    item: cat(
      'Okul & Kurs',
      'mdi-book-education',
      '#3b82f6',
      'demo-c-education',
      false,
      'Okul ücreti, kurs ve sertifika'
    )
  },
  {
    id: 'demo-c-books',
    item: cat(
      'Kitap & Yayın',
      'mdi-book-open-page-variant',
      '#3b82f6',
      'demo-c-education',
      false,
      'Kitap, dergi ve dijital yayın'
    )
  },
  {
    id: 'demo-c-stationery',
    item: cat(
      'Kırtasiye',
      'mdi-pencil-box',
      '#3b82f6',
      'demo-c-education',
      false,
      'Defter, kalem ve okul malzemesi'
    )
  },
  {
    id: 'demo-c-fun',
    item: cat(
      'Eğlence',
      'mdi-party-popper',
      '#8b5cf6',
      0,
      false,
      'Boş zaman ve eğlence harcamaları'
    )
  },
  {
    id: 'demo-c-cinema',
    item: cat(
      'Sinema & Tiyatro',
      'mdi-movie-open',
      '#8b5cf6',
      'demo-c-fun',
      false,
      'Bilet ve gösteri ücretleri'
    )
  },
  {
    id: 'demo-c-concert',
    item: cat(
      'Konser & Etkinlik',
      'mdi-music-note',
      '#8b5cf6',
      'demo-c-fun',
      false,
      'Konser, festival ve etkinlikler'
    )
  },
  {
    id: 'demo-c-games',
    item: cat(
      'Oyun',
      'mdi-gamepad-variant',
      '#8b5cf6',
      'demo-c-fun',
      false,
      'Oyun satın alma ve oyun içi harcama'
    )
  },
  {
    id: 'demo-c-media',
    item: cat(
      'Müzik & Film',
      'mdi-play-circle',
      '#8b5cf6',
      'demo-c-fun',
      false,
      'Albüm, film ve dijital içerik'
    )
  },
  {
    id: 'demo-c-hobby',
    item: cat(
      'Hobi',
      'mdi-palette',
      '#8b5cf6',
      'demo-c-fun',
      false,
      'Hobi malzemeleri ve aktiviteler'
    )
  },
  {
    id: 'demo-c-travel',
    item: cat('Seyahat', 'mdi-airplane', '#0284c7', 0, false, 'Şehir dışı ve yurt dışı yolculuklar')
  },
  {
    id: 'demo-c-ticket',
    item: cat(
      'Bilet & Ulaşım',
      'mdi-ticket',
      '#0284c7',
      'demo-c-travel',
      false,
      'Uçak, otobüs ve tren bileti'
    )
  },
  {
    id: 'demo-c-hotel',
    item: cat(
      'Konaklama',
      'mdi-bed',
      '#0284c7',
      'demo-c-travel',
      false,
      'Otel ve konaklama ücretleri'
    )
  },
  {
    id: 'demo-c-tour',
    item: cat(
      'Tur & Aktivite',
      'mdi-map-marker-path',
      '#0284c7',
      'demo-c-travel',
      false,
      'Tur, müze ve gezi aktiviteleri'
    )
  },
  {
    id: 'demo-c-tech',
    item: cat('Teknoloji', 'mdi-laptop', '#64748b', 0, false, 'Cihaz, yazılım ve dijital araçlar')
  },
  {
    id: 'demo-c-device',
    item: cat(
      'Elektronik Cihaz',
      'mdi-cellphone-link',
      '#64748b',
      'demo-c-tech',
      false,
      'Telefon, bilgisayar ve cihaz alımı'
    )
  },
  {
    id: 'demo-c-software',
    item: cat(
      'Yazılım & Uygulama',
      'mdi-application-brackets',
      '#64748b',
      'demo-c-tech',
      false,
      'Lisans ve uygulama satın alma'
    )
  },
  {
    id: 'demo-c-accessory',
    item: cat(
      'Sarf & Aksesuar',
      'mdi-usb',
      '#64748b',
      'demo-c-tech',
      false,
      'Kablo, bellek ve aksesuarlar'
    )
  },
  {
    id: 'demo-c-pet',
    item: cat('Evcil Hayvan', 'mdi-paw', '#f59e0b', 0, false, 'Evcil hayvan bakım giderleri')
  },
  {
    id: 'demo-c-pet-food',
    item: cat(
      'Mama & Bakım',
      'mdi-bone',
      '#f59e0b',
      'demo-c-pet',
      false,
      'Mama, kum ve bakım ürünleri'
    )
  },
  {
    id: 'demo-c-vet',
    item: cat(
      'Veteriner',
      'mdi-medical-bag',
      '#f59e0b',
      'demo-c-pet',
      false,
      'Muayene, aşı ve tedavi'
    )
  },
  {
    id: 'demo-c-finance',
    item: cat('Finans', 'mdi-bank-outline', '#4f46e5', 0, false, 'Kredi, ücret ve resmî ödemeler')
  },
  {
    id: 'demo-c-loan',
    item: cat(
      'Kredi Taksiti',
      'mdi-cash-clock',
      '#4f46e5',
      'demo-c-finance',
      false,
      'İhtiyaç kredisi taksitleri'
    )
  },
  {
    id: 'demo-c-bank-fee',
    item: cat(
      'Banka & İşlem Ücreti',
      'mdi-bank-transfer',
      '#4f46e5',
      'demo-c-finance',
      false,
      'Hesap işletim ve havale ücretleri'
    )
  },
  {
    id: 'demo-c-tax',
    item: cat(
      'Vergi & Harç',
      'mdi-gavel',
      '#4f46e5',
      'demo-c-finance',
      false,
      'Resmî vergi ve harç ödemeleri'
    )
  },
  {
    id: 'demo-c-interest',
    item: cat(
      'Faiz Gideri',
      'mdi-percent',
      '#4f46e5',
      'demo-c-finance',
      false,
      'Kredi kartı ve kredi faizi'
    )
  },
  {
    id: 'demo-c-invest',
    item: cat('Yatırım', 'mdi-chart-line', '#16a34a', 0, false, 'Değer saklama ve yatırım alımları')
  },
  {
    id: 'demo-c-stocks',
    item: cat(
      'Hisse & Fon',
      'mdi-finance',
      '#16a34a',
      'demo-c-invest',
      false,
      'Hisse senedi ve yatırım fonu alımı'
    )
  },
  {
    id: 'demo-c-gold-fx',
    item: cat(
      'Altın & Döviz',
      'mdi-gold',
      '#16a34a',
      'demo-c-invest',
      false,
      'Altın ve döviz alımı'
    )
  },
  {
    id: 'demo-c-crypto-buy',
    item: cat('Kripto Alımı', 'mdi-bitcoin', '#16a34a', 'demo-c-invest', false, 'Kripto para alımı')
  },
  {
    id: 'demo-c-pension',
    item: cat(
      'Emeklilik Katkısı',
      'mdi-account-clock',
      '#16a34a',
      'demo-c-invest',
      false,
      'BES katkı payı ödemesi'
    )
  },
  {
    id: 'demo-c-giving',
    item: cat('Bağış & Hediye', 'mdi-gift', '#ec4899', 0, false, 'Başkalarına yapılan ödemeler')
  },
  {
    id: 'demo-c-gift',
    item: cat(
      'Hediye',
      'mdi-gift-outline',
      '#ec4899',
      'demo-c-giving',
      false,
      'Doğum günü ve özel gün hediyeleri'
    )
  },
  {
    id: 'demo-c-donation',
    item: cat(
      'Bağış & Yardım',
      'mdi-hand-heart',
      '#ec4899',
      'demo-c-giving',
      false,
      'Yardım kuruluşlarına bağış'
    )
  },
  {
    id: 'demo-c-other',
    item: cat(
      'Diğer',
      'mdi-dots-horizontal-circle',
      '#78716c',
      0,
      false,
      'Sınıflandırılamayan harcamalar'
    )
  },
  {
    id: 'demo-c-unexpected',
    item: cat(
      'Beklenmeyen',
      'mdi-alert-circle-outline',
      '#78716c',
      'demo-c-other',
      false,
      'Plansız, tek seferlik giderler'
    )
  },
  {
    id: 'demo-c-unsorted',
    item: cat(
      'Sınıflandırılmamış',
      'mdi-help-circle-outline',
      '#78716c',
      'demo-c-other',
      false,
      'Henüz kategorilenmemiş işlemler'
    )
  }
]

function tag(name: string, color: string, desc = ''): TagItem {
  return { name, color, desc }
}

/**
 * Etiketler — "hangi bağlamda / nasıl" (çoklu seçim, kesişir).
 * Kategorilerle kasıtlı olarak ÇAKIŞMAZ: "para ne için harcandı" sorusu
 * kategorinin işi. Market/Kira/Sağlık gibi isimler bu yüzden burada YOK —
 * bir işlem tek kategori + birden çok etiket taşır.
 */
const tags: { id: string; item: TagItem }[] = [
  { id: 'demo-tag-zorunlu', item: tag('Zorunlu', '#ef4444', 'Kısılamaz, temel yaşam gideri') },
  { id: 'demo-tag-keyfi', item: tag('Keyfi', '#a855f7', 'Kısılabilir, isteğe bağlı harcama') },
  { id: 'demo-tag-aylik', item: tag('Aylık', '#14b8a6', 'Her ay düzenli tekrarlayan') },
  { id: 'demo-tag-yillik', item: tag('Yıllık', '#0891b2', 'Yılda bir kez ödenen') },
  {
    id: 'demo-tag-tek-seferlik',
    item: tag('Tek seferlik', '#0ea5e9', 'Tekrarlamayan, bir defalık')
  },
  { id: 'demo-tag-abonelik', item: tag('Abonelik', '#f59e0b', 'Otomatik yenilenen üyelik') },
  { id: 'demo-tag-nakit', item: tag('Nakit', '#22c55e', 'Nakit olarak yapılan ödeme') },
  {
    id: 'demo-tag-kredi-karti',
    item: tag('Kredi kartı', '#d946ef', 'Kartla yapılan, sonra ödenecek')
  },
  { id: 'demo-tag-havale', item: tag('Havale/EFT', '#2563eb', 'Banka üzerinden transfer') },
  { id: 'demo-tag-taksitli', item: tag('Taksitli', '#c026d3', 'Birden fazla taksite bölünmüş') },
  { id: 'demo-tag-aile', item: tag('Aile', '#f97316', 'Ev halkının ortak gideri') },
  { id: 'demo-tag-cocuk', item: tag('Çocuk', '#fb7185', 'Çocuklara ait harcama') },
  { id: 'demo-tag-kisisel', item: tag('Kişisel', '#8b5cf6', 'Yalnız kendine ait harcama') },
  { id: 'demo-tag-is', item: tag('İş', '#6366f1', 'İşle ilgili gelir veya gider') },
  { id: 'demo-tag-tatil', item: tag('Tatil', '#06b6d4', 'Tatil döneminde yapılan') },
  { id: 'demo-tag-acil', item: tag('Acil', '#b91c1c', 'Plansız, beklenmedik gider') },
  { id: 'demo-tag-planli', item: tag('Planlı', '#16a34a', 'Bütçede öngörülmüş harcama') },
  { id: 'demo-tag-plansiz', item: tag('Plansız', '#ea580c', 'Bütçede öngörülmemiş harcama') },
  {
    id: 'demo-tag-indirimli',
    item: tag('İndirimli', '#65a30d', 'Kampanya veya indirimle alınmış')
  },
  {
    id: 'demo-tag-iade',
    item: tag('İade edilebilir', '#78716c', 'Geri alınabilir veya masraf olarak yazılabilir')
  }
]

// Kategoriye göre sabit etiketler: o kategorinin HER işlemine uygulanır.
// Nitelikler kategoriden türetilebildiği ölçüde otomatik: market zorunlu, kafe keyfi.
const tagByCategory: Record<string, string[]> = {
  'demo-c-market': ['demo-tag-zorunlu', 'demo-tag-aile'],
  'demo-c-butcher': ['demo-tag-zorunlu', 'demo-tag-aile'],
  'demo-c-restaurant': ['demo-tag-keyfi'],
  'demo-c-cafe': ['demo-tag-keyfi', 'demo-tag-kisisel'],
  'demo-c-delivery': ['demo-tag-keyfi'],
  'demo-c-fuel': ['demo-tag-zorunlu'],
  'demo-c-taxi': ['demo-tag-plansiz'],
  'demo-c-transit': ['demo-tag-zorunlu', 'demo-tag-aylik'],
  'demo-c-electric': ['demo-tag-zorunlu', 'demo-tag-aylik'],
  'demo-c-water': ['demo-tag-zorunlu', 'demo-tag-aylik'],
  'demo-c-gas': ['demo-tag-zorunlu', 'demo-tag-aylik'],
  'demo-c-internet': ['demo-tag-zorunlu', 'demo-tag-aylik', 'demo-tag-abonelik'],
  'demo-c-streaming': ['demo-tag-keyfi', 'demo-tag-aylik', 'demo-tag-abonelik'],
  'demo-c-rent': ['demo-tag-zorunlu', 'demo-tag-aylik', 'demo-tag-havale'],
  'demo-c-dues': ['demo-tag-zorunlu', 'demo-tag-aylik'],
  'demo-c-clothing': ['demo-tag-keyfi'],
  'demo-c-gym': ['demo-tag-keyfi', 'demo-tag-aylik', 'demo-tag-abonelik', 'demo-tag-kisisel'],
  'demo-c-pharmacy': ['demo-tag-zorunlu', 'demo-tag-plansiz'],
  'demo-c-cinema': ['demo-tag-keyfi'],
  'demo-c-games': ['demo-tag-keyfi', 'demo-tag-kisisel'],
  'demo-c-course': ['demo-tag-planli', 'demo-tag-kisisel'],
  'demo-c-gift': ['demo-tag-plansiz'],
  'demo-c-stocks': ['demo-tag-planli', 'demo-tag-havale']
}

// Dönüşümlü ek etiketler: işlem sırasına göre (i % uzunluk) dağıtılır.
// Kategoriden türetilemeyen, işleme özgü nitelikler — dağılıma uzun kuyruk katar.
// Deterministik: aynı seed her zaman aynı sonucu verir.
const rotatingTags: string[] = [
  'demo-tag-nakit',
  'demo-tag-kredi-karti',
  'demo-tag-havale',
  'demo-tag-taksitli',
  'demo-tag-planli',
  'demo-tag-plansiz',
  'demo-tag-indirimli',
  'demo-tag-kisisel',
  'demo-tag-aile',
  'demo-tag-cocuk',
  'demo-tag-tatil',
  'demo-tag-tek-seferlik'
]

// [gün önce, kategori, cüzdan, tutar, açıklama] — yeni kategori ağacına göre, ~3 aya yayılmış.
// Kira/fatura/taksit gibi kalemler 3 kez tekrarlanır (aylık gerçekçilik).
//
// Açıklama kategorinin TEKRARI DEĞİL: kategori "ne için" sorusunu zaten
// yanıtlıyor (Market), açıklama işleme özgü olanı taşır (hangi zincir, ne
// alındı). Aksi halde sütun boş yere yer kaplardı.
const expenseRows: [number, string, string, number, string][] = [
  [1, 'demo-c-market', 'demo-w-cash', 420, 'BİM — haftalık temel gıda'],
  [3, 'demo-c-market', 'demo-w-bonus', 1180, 'Migros — aylık büyük alışveriş'],
  [8, 'demo-c-market', 'demo-w-cash', 380, 'A101 — süt, yumurta, ekmek'],
  [10, 'demo-c-market', 'demo-w-bonus', 960, 'CarrefourSA — deterjan ve temizlik ürünleri'],
  [15, 'demo-c-market', 'demo-w-garanti', 1240, 'Macrocenter — haftalık market'],
  [22, 'demo-c-market', 'demo-w-bonus', 890, 'Şok — kuru gıda stoğu'],
  [29, 'demo-c-market', 'demo-w-cash', 450, 'BİM — meyve sebze'],
  [36, 'demo-c-market', 'demo-w-bonus', 1320, 'Migros — aylık market alışverişi'],
  [43, 'demo-c-market', 'demo-w-garanti', 1050, 'CarrefourSA — haftalık market'],
  [50, 'demo-c-market', 'demo-w-bonus', 970, 'Metro — toplu alım'],
  [57, 'demo-c-market', 'demo-w-cash', 410, 'A101 — günlük ihtiyaçlar'],
  [64, 'demo-c-market', 'demo-w-bonus', 1150, 'Migros — aylık büyük alışveriş'],
  [5, 'demo-c-butcher', 'demo-w-cash', 680, 'Kasap — kıyma ve kuşbaşı'],
  [19, 'demo-c-butcher', 'demo-w-garanti', 720, 'Kasap — tavuk ve dana eti'],
  [47, 'demo-c-butcher', 'demo-w-cash', 640, 'Kasap — haftalık et alımı'],
  [2, 'demo-c-bakery', 'demo-w-cash', 95, 'Fırın — ekmek ve poğaça'],
  [16, 'demo-c-bakery', 'demo-w-cash', 110, 'Fırın — sabah simidi ve ekmek'],
  [44, 'demo-c-bakery', 'demo-w-cash', 85, 'Fırın — günlük ekmek'],
  [2, 'demo-c-restaurant', 'demo-w-world', 740, 'Kebapçıda akşam yemeği'],
  [12, 'demo-c-restaurant', 'demo-w-bonus', 520, 'İş çıkışı öğle yemeği'],
  [26, 'demo-c-restaurant', 'demo-w-world', 890, 'Balık restoranı — aile yemeği'],
  [54, 'demo-c-restaurant', 'demo-w-bonus', 610, 'Hafta sonu serpme kahvaltı'],
  [1, 'demo-c-cafe', 'demo-w-cash', 120, 'Starbucks — filtre kahve'],
  [4, 'demo-c-cafe', 'demo-w-cash', 95, 'Mahalle kahvecisi — americano'],
  [9, 'demo-c-cafe', 'demo-w-world', 150, 'Gloria Jeans — latte ve kurabiye'],
  [18, 'demo-c-cafe', 'demo-w-cash', 110, 'Kahve Dünyası — türk kahvesi'],
  [31, 'demo-c-cafe', 'demo-w-world', 135, 'Starbucks — soğuk kahve'],
  [58, 'demo-c-cafe', 'demo-w-cash', 105, 'Kafede çay molası'],
  [7, 'demo-c-delivery', 'demo-w-world', 380, 'Yemeksepeti — akşam siparişi'],
  [24, 'demo-c-delivery', 'demo-w-maximum', 420, 'Getir Yemek — öğle siparişi'],
  [52, 'demo-c-delivery', 'demo-w-world', 350, 'Trendyol Yemek — pizza siparişi'],
  [3, 'demo-c-fuel', 'demo-w-bonus', 1450, 'Shell — depo dolumu'],
  [17, 'demo-c-fuel', 'demo-w-bonus', 1380, 'Opet — benzin'],
  [33, 'demo-c-fuel', 'demo-w-bonus', 1520, 'BP — depo dolumu'],
  [48, 'demo-c-fuel', 'demo-w-bonus', 1400, 'Petrol Ofisi — benzin'],
  [62, 'demo-c-fuel', 'demo-w-bonus', 1470, 'Shell — yakıt alımı'],
  [6, 'demo-c-transit', 'demo-w-garanti', 350, 'İstanbulkart — bakiye yükleme'],
  [34, 'demo-c-transit', 'demo-w-garanti', 350, 'İstanbulkart — aylık yükleme'],
  [63, 'demo-c-transit', 'demo-w-garanti', 350, 'İstanbulkart — bakiye yükleme'],
  [8, 'demo-c-taxi', 'demo-w-cash', 185, 'Taksiyle eve dönüş'],
  [25, 'demo-c-taxi', 'demo-w-cash', 240, 'BiTaksi — gece dönüşü'],
  [51, 'demo-c-taxi', 'demo-w-cash', 210, 'Yağmurda işe gidiş'],
  [11, 'demo-c-parking', 'demo-w-cash', 60, 'İSPARK — saatlik otopark'],
  [39, 'demo-c-parking', 'demo-w-cash', 75, 'AVM otoparkı'],
  [28, 'demo-c-car-service', 'demo-w-maximum', 3200, 'Periyodik bakım — yağ ve filtre değişimi'],
  [20, 'demo-c-car-insurance', 'demo-w-garanti', 4800, 'Kasko yenileme — yıllık prim'],
  [5, 'demo-c-car-loan', 'demo-w-ziraat', 5200, 'Taşıt kredisi — aylık taksit'],
  [35, 'demo-c-car-loan', 'demo-w-ziraat', 5200, 'Taşıt kredisi — aylık taksit'],
  [65, 'demo-c-car-loan', 'demo-w-ziraat', 5200, 'Taşıt kredisi — aylık taksit'],
  [1, 'demo-c-rent', 'demo-w-ziraat', 18000, 'Ev kirası — aylık ödeme'],
  [31, 'demo-c-rent', 'demo-w-ziraat', 18000, 'Ev kirası — aylık ödeme'],
  [61, 'demo-c-rent', 'demo-w-ziraat', 18000, 'Ev kirası — aylık ödeme'],
  [4, 'demo-c-dues', 'demo-w-garanti', 1400, 'Apartman aidatı'],
  [34, 'demo-c-dues', 'demo-w-garanti', 1400, 'Apartman aidatı'],
  [64, 'demo-c-dues', 'demo-w-garanti', 1400, 'Apartman aidatı'],
  [6, 'demo-c-electric', 'demo-w-garanti', 890, 'BEDAŞ — elektrik faturası'],
  [36, 'demo-c-electric', 'demo-w-garanti', 760, 'BEDAŞ — elektrik faturası'],
  [66, 'demo-c-electric', 'demo-w-garanti', 820, 'BEDAŞ — elektrik faturası'],
  [6, 'demo-c-water', 'demo-w-garanti', 210, 'İSKİ — su faturası'],
  [36, 'demo-c-water', 'demo-w-garanti', 195, 'İSKİ — su faturası'],
  [7, 'demo-c-gas', 'demo-w-garanti', 1650, 'İGDAŞ — doğalgaz faturası'],
  [37, 'demo-c-gas', 'demo-w-garanti', 1420, 'İGDAŞ — doğalgaz faturası'],
  [9, 'demo-c-internet', 'demo-w-garanti', 480, 'Türk Telekom — fiber internet'],
  [39, 'demo-c-internet', 'demo-w-garanti', 480, 'Türk Telekom — fiber internet'],
  [69, 'demo-c-internet', 'demo-w-garanti', 480, 'Türk Telekom — fiber internet'],
  [9, 'demo-c-phone', 'demo-w-garanti', 320, 'Turkcell — mobil hat faturası'],
  [39, 'demo-c-phone', 'demo-w-garanti', 320, 'Turkcell — mobil hat faturası'],
  [10, 'demo-c-streaming', 'demo-w-world', 180, 'Netflix — aylık abonelik'],
  [40, 'demo-c-streaming', 'demo-w-world', 180, 'Netflix — aylık abonelik'],
  [70, 'demo-c-streaming', 'demo-w-world', 180, 'Netflix — aylık abonelik'],
  [14, 'demo-c-repair', 'demo-w-maximum', 2400, 'Kombi arızası — servis onarımı'],
  [41, 'demo-c-furniture', 'demo-w-maximum', 8900, 'Yemek masası ve sandalye takımı'],
  [13, 'demo-c-pharmacy', 'demo-w-cash', 340, 'Eczane — reçeteli ilaç'],
  [45, 'demo-c-pharmacy', 'demo-w-cash', 280, 'Eczane — vitamin ve ağrı kesici'],
  [27, 'demo-c-doctor', 'demo-w-world', 1200, 'Özel muayene — dahiliye kontrolü'],
  [55, 'demo-c-dental', 'demo-w-maximum', 4500, 'Diş tedavisi — dolgu ve temizlik'],
  [2, 'demo-c-gym', 'demo-w-world', 900, 'Spor salonu — aylık üyelik'],
  [32, 'demo-c-gym', 'demo-w-world', 900, 'Spor salonu — aylık üyelik'],
  [62, 'demo-c-gym', 'demo-w-world', 900, 'Spor salonu — aylık üyelik'],
  [21, 'demo-c-clothing', 'demo-w-maximum', 2800, 'Kışlık mont ve bot'],
  [49, 'demo-c-clothing', 'demo-w-world', 1650, 'Gömlek ve pantolon'],
  [12, 'demo-c-hair', 'demo-w-cash', 350, 'Kuaför — saç kesimi'],
  [42, 'demo-c-hair', 'demo-w-cash', 350, 'Kuaför — saç kesimi ve sakal'],
  [23, 'demo-c-cosmetics', 'demo-w-world', 480, 'Cilt bakım ürünleri'],
  // Tutarlar cüzdanın PARA BİRİMİNDE: wise GBP, broker/amex USD, binance USDT.
  // 1800 GBP'lik kurs ~90.000 ₺ ederdi; bu profilin (aylık ~68.000 ₺) fonlayabileceği
  // bir rakam değil ve fonlama transferi saçma çıkardı.
  [30, 'demo-c-course', 'demo-w-wise', 180, 'Online eğitim platformu — yıllık üyelik'],
  [38, 'demo-c-books', 'demo-w-world', 420, 'Kitap siparişi — üç roman'],
  [15, 'demo-c-cinema', 'demo-w-world', 360, 'Sinema — iki kişilik bilet'],
  [46, 'demo-c-cinema', 'demo-w-world', 380, 'Sinema — vizyon filmi'],
  [56, 'demo-c-games', 'demo-w-amex', 59, 'Steam — oyun satın alma'],
  [11, 'demo-c-hobby', 'demo-w-world', 540, 'Fotoğraf malzemeleri'],
  [59, 'demo-c-device', 'demo-w-maximum', 24000, 'Yeni telefon — 12 taksit'],
  [18, 'demo-c-software', 'demo-w-amex', 89, 'Adobe Creative Cloud — aylık abonelik'],
  [48, 'demo-c-software', 'demo-w-amex', 89, 'Adobe Creative Cloud — aylık abonelik'],
  [16, 'demo-c-pet-food', 'demo-w-bonus', 680, 'Kedi maması — 4 kg'],
  [46, 'demo-c-pet-food', 'demo-w-bonus', 720, 'Kedi maması ve kum'],
  [53, 'demo-c-vet', 'demo-w-world', 950, 'Veteriner — aşı ve genel kontrol'],
  [5, 'demo-c-loan', 'demo-w-ziraat', 3400, 'İhtiyaç kredisi — aylık taksit'],
  [35, 'demo-c-loan', 'demo-w-ziraat', 3400, 'İhtiyaç kredisi — aylık taksit'],
  [65, 'demo-c-loan', 'demo-w-ziraat', 3400, 'İhtiyaç kredisi — aylık taksit'],
  [25, 'demo-c-bank-fee', 'demo-w-garanti', 45, 'Hesap işletim ücreti'],
  [60, 'demo-c-tax', 'demo-w-garanti', 2200, 'MTV — ikinci taksit'],
  [19, 'demo-c-gift', 'demo-w-world', 850, 'Doğum günü hediyesi'],
  [40, 'demo-c-donation', 'demo-w-garanti', 500, 'Yardım derneğine bağış'],
  // BIST alımı TL hesabından (İş Yatırım), ABD hissesi dolar hesabından (Midas) —
  // cüzdanların kendi açıklamalarıyla da tutarlı. Önce ikisi de Midas'ta 5.000 USD
  // yazıyordu: 3 ayda ~470.000 ₺, gelirin çok üstünde.
  [3, 'demo-c-stocks', 'demo-w-isyatirim', 5000, 'BIST hisse alımı — aylık düzenli yatırım'],
  [33, 'demo-c-stocks', 'demo-w-broker', 400, 'ABD hissesi alımı — aylık düzenli yatırım'],
  [20, 'demo-c-gold-fx', 'demo-w-gold', 3000, 'Gram altın alımı'],
  [50, 'demo-c-crypto-buy', 'demo-w-binance', 250, 'BTC alımı — düzenli birikim']
]

/**
 * Transferler — paranın hesaplar ARASINDA dolaştığı yer.
 *
 * Neden var: bunlar olmadan maaş ziraat'a iniyor ve orada kalıyordu; faturalar
 * garanti'den çıkıyor ama garanti'ye hiç para girmiyordu (90 günde −17.000'e
 * düşüyordu), üç kredi kartının ekstresi hiç ödenmediği için borç sadece
 * büyüyordu. Gerçek bir defterde hiçbir hesap böyle davranmaz.
 *
 * [gün önce, kaynak, hedef, çıkan tutar, giren tutar, açıklama]
 * Çıkan ≠ giren OLABİLİR: para birimi değişen transferlerde (₺ → USD/GBP/USDT)
 * iki bacak kendi biriminde yazılır. Kurlar canlı servisten geldiği için burada
 * yaklaşık piyasa değerleri kullanıldı.
 *
 * DİKKAT: transfer GELİR DEĞİLDİR (muhasebe kuralı, `flow` onu hariç tutar). Yani
 * fatura hesabının "Gelir" sayacı 0 kalmaya devam eder — doğrusu da bu; o hesaba
 * para kazanılarak değil aktarılarak giriyor. Değişen şey bakiye seyri: tek yönlü
 * düşüş yerine "doldur–harca–doldur" testeresi.
 */
const transferRows: [number, string, string, number, number, string][] = [
  // Serbest çalışma geliri ticari hesapta toplanıp şahsi hesaba aktarılıyor.
  [8, 'demo-w-business', 'demo-w-ziraat', 11000, 11000, 'Serbest gelir — şahsi hesaba aktarım'],
  [26, 'demo-w-business', 'demo-w-ziraat', 8000, 8000, 'Serbest gelir — şahsi hesaba aktarım'],
  [43, 'demo-w-business', 'demo-w-ziraat', 14000, 14000, 'Serbest gelir — şahsi hesaba aktarım'],
  [57, 'demo-w-business', 'demo-w-ziraat', 6000, 6000, 'Serbest gelir — şahsi hesaba aktarım'],

  // Maaşın indiği hesaptan fatura hesabına aylık aktarım (garanti 90 günde ~23.800 harcıyor).
  [60, 'demo-w-ziraat', 'demo-w-garanti', 9000, 9000, 'Fatura hesabına aylık aktarım'],
  [30, 'demo-w-ziraat', 'demo-w-garanti', 9000, 9000, 'Fatura hesabına aylık aktarım'],
  [1, 'demo-w-ziraat', 'demo-w-garanti', 8000, 8000, 'Fatura hesabına aylık aktarım'],

  // Nakit çekimleri (cash 90 günde ~5.800 harcıyor).
  [55, 'demo-w-ziraat', 'demo-w-cash', 1500, 1500, 'ATM — nakit çekimi'],
  [40, 'demo-w-ziraat', 'demo-w-cash', 1500, 1500, 'ATM — nakit çekimi'],
  [20, 'demo-w-ziraat', 'demo-w-cash', 1500, 1500, 'ATM — nakit çekimi'],
  [5, 'demo-w-ziraat', 'demo-w-cash', 1000, 1000, 'ATM — nakit çekimi'],

  // Kredi kartı ekstre ödemeleri. Kasıtlı olarak harcamanın TAMAMI kapatılmıyor:
  // son dönemin ekstresi açık kalıyor, kartlar makul bir borçla duruyor.
  [58, 'demo-w-ziraat', 'demo-w-bonus', 5000, 5000, 'Garanti Bonus — ekstre ödemesi'],
  [28, 'demo-w-ziraat', 'demo-w-bonus', 5500, 5500, 'Garanti Bonus — ekstre ödemesi'],
  [57, 'demo-w-ziraat', 'demo-w-maximum', 12000, 12000, 'İş Bankası Maximum — ekstre ödemesi'],
  [27, 'demo-w-ziraat', 'demo-w-maximum', 12000, 12000, 'İş Bankası Maximum — ekstre ödemesi'],
  [2, 'demo-w-ziraat', 'demo-w-maximum', 12000, 12000, 'İş Bankası Maximum — ekstre ödemesi'],
  // World kartı Yapı Kredi'den ödeniyor — o cüzdanın kendi açıklaması zaten
  // "Kredi kartı ekstre ödemeleri" diyor, ama hiç işlemi yoktu. Aktarım → ödeme.
  [59, 'demo-w-ziraat', 'demo-w-yapikredi', 4500, 4500, 'Kart ödemesi için aktarım'],
  [29, 'demo-w-ziraat', 'demo-w-yapikredi', 4500, 4500, 'Kart ödemesi için aktarım'],
  [58, 'demo-w-yapikredi', 'demo-w-world', 4500, 4500, 'Yapı Kredi World — ekstre ödemesi'],
  [28, 'demo-w-yapikredi', 'demo-w-world', 4500, 4500, 'Yapı Kredi World — ekstre ödemesi'],
  // Amex dolar kartı, dolar hesabından ödeniyor.
  [45, 'demo-w-usd-acc', 'demo-w-amex', 200, 200, 'Amex — ekstre ödemesi'],
  [15, 'demo-w-usd-acc', 'demo-w-amex', 200, 200, 'Amex — ekstre ödemesi'],

  // Birikim ve yatırım fonlaması.
  [59, 'demo-w-ziraat', 'demo-w-enpara-save', 3000, 3000, 'Aylık birikim'],
  [29, 'demo-w-ziraat', 'demo-w-enpara-save', 3000, 3000, 'Aylık birikim'],
  [4, 'demo-w-ziraat', 'demo-w-isyatirim', 5000, 5000, 'Yatırım hesabına aktarım'],
  [21, 'demo-w-ziraat', 'demo-w-gold', 3000, 3000, 'Altın hesabına aktarım'],
  // Para birimi değişen bacaklar (yaklaşık kur).
  [34, 'demo-w-ziraat', 'demo-w-broker', 19000, 400, 'Midas — döviz yatırım aktarımı'],
  [51, 'demo-w-ziraat', 'demo-w-binance', 11800, 250, 'Binance — kripto alımı için aktarım'],
  [31, 'demo-w-ziraat', 'demo-w-wise', 11400, 180, 'Wise — yurt dışı ödeme için aktarım']
]

/** export YALNIZ test için: üretilen işlem kümesi doğrudan ölçülebilsin diye. */
export function buildTrns(now: number): { id: string; item: TrnItem }[] {
  const list: { id: string; item: TrnItem }[] = []

  // Maaş (aylık, 3 ay)
  ;[2, 32, 62].forEach((d, i) => {
    list.push({
      id: `demo-t-inc-${i}`,
      item: {
        type: TrnType.Income,
        amount: 68000,
        categoryId: 'demo-c-salary',
        walletId: 'demo-w-ziraat',
        date: now - d * DAY,
        updatedAt: now,
        desc: 'Aylık maaş ödemesi',
        tagIds: ['demo-tag-is', 'demo-tag-aylik', 'demo-tag-havale']
      }
    })
  })

  // Serbest çalışma geliri (düzensiz)
  ;(
    [
      [9, 12000, 'Web sitesi projesi — son ödeme'],
      [27, 8500, 'Logo ve kurumsal kimlik tasarımı'],
      [44, 15000, 'Mobil uygulama geliştirme — hakediş'],
      [58, 6200, 'Danışmanlık — saatlik ücret']
    ] as [number, number, string][]
  ).forEach(([d, amount, desc], i) => {
    list.push({
      id: `demo-t-free-${i}`,
      item: {
        type: TrnType.Income,
        amount,
        categoryId: 'demo-c-freelance',
        walletId: 'demo-w-business',
        date: now - d * DAY,
        updatedAt: now,
        desc,
        tagIds: ['demo-tag-is', 'demo-tag-havale']
      }
    })
  })

  // Yıllık prim (tek seferlik)
  list.push({
    id: 'demo-t-bonus-0',
    item: {
      type: TrnType.Income,
      amount: 25000,
      categoryId: 'demo-c-bonus',
      walletId: 'demo-w-ziraat',
      date: now - 40 * DAY,
      updatedAt: now,
      desc: 'Yıllık performans primi',
      tagIds: ['demo-tag-is', 'demo-tag-yillik', 'demo-tag-tek-seferlik']
    }
  })

  // Giderler — kategorinin sabit etiketleri + sıraya göre dönüşümlü bir ek etiket
  expenseRows.forEach(([d, categoryId, walletId, amount, desc], i) => {
    const tagIds = [...(tagByCategory[categoryId] ?? []), rotatingTags[i % rotatingTags.length]!]
    list.push({
      id: `demo-t-exp-${i}`,
      item: {
        type: TrnType.Expense,
        amount,
        categoryId,
        walletId,
        date: now - d * DAY,
        updatedAt: now,
        desc,
        tagIds
      }
    })
  })

  // Transferler — hesaplar arası akış (yukarıdaki transferRows).
  transferRows.forEach(([d, from, to, out, inn, desc], i) => {
    list.push({
      id: `demo-t-trf-${i}`,
      item: {
        type: TrnType.Transfer,
        categoryId: 'transfer',
        expenseWalletId: from,
        expenseAmount: out,
        incomeWalletId: to,
        incomeAmount: inn,
        date: now - d * DAY,
        updatedAt: now,
        desc
      }
    })
  })

  // Tasarrufa düzeltme (başlangıç bakiyesi)
  list.push({
    id: 'demo-t-adj-0',
    item: {
      type: TrnType.Income,
      amount: 1000,
      categoryId: 'adjustment',
      walletId: 'demo-w-td32',
      date: now - 70 * DAY,
      updatedAt: now,
      desc: 'Vadeli hesap — dönem faizi düzeltmesi'
    }
  })

  // Ek cüzdanların açılış bakiyeleri.
  // 'adjustment' kullanılıyor çünkü bunlar gerçek bir gelir/gider değil, cüzdanın
  // başlangıç durumu. Gelir olarak yazsaydık gelir toplamları ve kategori
  // istatistikleri şişerdi (getTotal düzeltmeleri zaten hariç tutuyor).
  // opening === 0 olanlar bilerek atlanır: hiç işlemi olmayan cüzdan da olsun.
  for (const w of wallets) {
    if (!w.opening) continue
    list.push({
      id: `demo-t-open-${w.id}`,
      item: {
        type: w.opening > 0 ? TrnType.Income : TrnType.Expense,
        amount: Math.abs(w.opening),
        categoryId: 'adjustment',
        walletId: w.id,
        date: now - 80 * DAY,
        updatedAt: now,
        // Negatif açılış "bakiye" değil BORÇ (kredi kartı, krediler) — açıklama
        // da öyle demeli, yoksa −420.000'lik konut kredisi "açılış bakiyesi"
        // olarak okunurdu.
        desc: w.opening > 0 ? 'Açılış bakiyesi' : 'Açılış borcu'
      }
    })
  }

  return list
}

/** Örnek veriyi yükler. Hata olursa fırlatır (çağıran mesajı gösterir). */
export async function seedDemoData(): Promise<void> {
  if (!isTauriRuntime()) throw new Error('Tauri runtime gerekli (npm run tauri:dev)')

  for (const w of wallets) await upsertRow('wallets', w.id, walletToRow(w.item, uid))
  for (const c of categories) await upsertRow('categories', c.id, categoryToRow(c.item, uid))
  for (const tag of tags) await upsertRow('tags', tag.id, tagToRow(tag.item, uid))
  for (const t of buildTrns(Date.now())) await upsertRow('trns', t.id, trnToRow(t.item, uid))
  emitTableChange('wallets', 'categories', 'tags', 'trns')
}

export async function clearAllData(): Promise<void> {
  if (!isTauriRuntime()) throw new Error('Tauri runtime gerekli (npm run tauri:dev)')

  const db = await getDb()
  for (const t of ['trns', 'wallets', 'categories', 'tags']) await db.execute(`DELETE FROM ${t}`)
  emitTableChange('trns', 'wallets', 'categories', 'tags')
}
