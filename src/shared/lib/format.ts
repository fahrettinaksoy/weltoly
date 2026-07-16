import { format as fnsFormat } from 'date-fns'

// Yerel biçimlendirme (formatting): sayı, para, tarih ve haftanın ilk günü.
// Tek kaynak — tüm proje bu tanımları ve fonksiyonları kullanır.
// 'auto' seçenekleri uygulama diline göre biçimlendirir (yerel duruma göre).

export type NumberFormatKey = 'auto' | 'comma_dot' | 'dot_comma' | 'space_comma' | 'apos_dot'
export type DateFormatKey = 'auto' | 'mdy' | 'dmy' | 'ymd' | 'dmy_dot'
export type WeekStart = 0 | 1 // 0 = Pazar, 1 = Pazartesi

// Her sayı biçimi, o binlik/ondalık stilini üreten temsili bir Intl locale'ine eşlenir.
export const NUMBER_FORMATS: { key: NumberFormatKey, locale: string | null, sample: string }[] = [
  { key: 'auto', locale: null, sample: '' },
  { key: 'comma_dot', locale: 'en-US', sample: '1,000.33' },
  { key: 'dot_comma', locale: 'de-DE', sample: '1.000,33' },
  { key: 'space_comma', locale: 'fr-FR', sample: '1 000,33' },
  { key: 'apos_dot', locale: 'de-CH', sample: '1’000.33' },
]

// date-fns pattern'ları; 'auto' → dile göre Intl.DateTimeFormat.
export const DATE_FORMATS: { key: DateFormatKey, pattern: string | null, sample: string }[] = [
  { key: 'auto', pattern: null, sample: '' },
  { key: 'mdy', pattern: 'MM/dd/yyyy', sample: 'MM/DD/YYYY' },
  { key: 'dmy', pattern: 'dd/MM/yyyy', sample: 'DD/MM/YYYY' },
  { key: 'ymd', pattern: 'yyyy-MM-dd', sample: 'YYYY-MM-DD' },
  { key: 'dmy_dot', pattern: 'dd.MM.yyyy', sample: 'DD.MM.YYYY' },
]

export interface FormatOptions {
  numberFormat: NumberFormatKey
  dateFormat: DateFormatKey
  hideDecimals: boolean
  locale: string
}

function numberLocale(key: NumberFormatKey, appLocale: string): string {
  return NUMBER_FORMATS.find(f => f.key === key)?.locale ?? appLocale
}

/** Binlik ve ondalık ayracı (giriş alanları için). */
export interface NumberSeparators {
  group: string
  decimal: string
}

/**
 * Seçili sayı biçiminin ayraçlarını Intl'den ÖĞRENİR — elle tablo tutmaz.
 * NUMBER_FORMATS zaten her biçimi temsilî bir locale'e eşliyor; ayraçları da
 * oradan sormak tek kaynak demek: 'auto' uygulama diline uyar ve biçim listesi
 * büyüdüğünde burası kendiliğinden doğru kalır.
 *
 * Not: bazı locale'ler binlik için normal boşluk değil dar bölünmez boşluk
 * (U+202F, fr-FR) kullanır. Sorun değil — biçimlendirme ve geri çözme aynı
 * karakteri kullandığı sürece gidiş-dönüş tutarlı.
 */
export function getNumberSeparators(o: FormatOptions): NumberSeparators {
  const loc = numberLocale(o.numberFormat, o.locale)
  const parts = new Intl.NumberFormat(loc).formatToParts(1234567.8)
  return {
    group: parts.find(p => p.type === 'group')?.value ?? ',',
    decimal: parts.find(p => p.type === 'decimal')?.value ?? '.',
  }
}

/** Tutarı para birimiyle biçimlendirir. Geçersiz/kripto kodlarda güvenli fallback. */
export function formatMoney(amount: number, currency: string, o: FormatOptions): string {
  const loc = numberLocale(o.numberFormat, o.locale)
  const digits = o.hideDecimals ? 0 : 2
  try {
    return new Intl.NumberFormat(loc, {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amount)
  }
  catch {
    const n = new Intl.NumberFormat(loc, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount)
    return `${n} ${currency}`
  }
}

/** Para birimsiz sayı biçimi (binlik/ondalık ayraç dile/ayara göre). */
export function formatNumber(value: number, o: FormatOptions): string {
  const loc = numberLocale(o.numberFormat, o.locale)
  const digits = o.hideDecimals ? 0 : 2
  return new Intl.NumberFormat(loc, { maximumFractionDigits: digits }).format(value)
}

/** Sayısal tarih biçimi (MM/DD/YYYY vb.); 'auto' dile göre. */
export function formatDate(ts: number | Date, o: FormatOptions): string {
  const pattern = DATE_FORMATS.find(f => f.key === o.dateFormat)?.pattern
  if (pattern)
    return fnsFormat(ts, pattern)
  return new Intl.DateTimeFormat(o.locale, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(ts)
}
