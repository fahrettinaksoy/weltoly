import { useSettingsStore } from '@/stores/settings'
import * as fmt from '@/shared/lib/format'

/**
 * Yerel biçimlendirme köprüsü: ayarları (numberFormat/dateFormat/hideDecimals/locale)
 * merkezî format fonksiyonlarına bağlar. Tüm proje para/sayı/tarih için bunu kullanır.
 * AutoImport ile global erişilebilir — ayrıca import gerekmez.
 */
export function useFormat() {
  const settings = useSettingsStore()

  const opts = (): fmt.FormatOptions => ({
    numberFormat: settings.numberFormat,
    dateFormat: settings.dateFormat,
    hideDecimals: settings.hideDecimals,
    locale: settings.locale,
  })

  return {
    /** Para birimiyle biçimlendirilmiş tutar. */
    money: (amount: number, currency: string) => fmt.formatMoney(amount, currency, opts()),
    /** Para birimsiz sayı. */
    number: (value: number) => fmt.formatNumber(value, opts()),
    /** Sayısal tarih (ayardaki biçime göre). */
    date: (ts: number | Date) => fmt.formatDate(ts, opts()),
  }
}

