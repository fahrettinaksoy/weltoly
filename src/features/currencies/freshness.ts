/**
 * Kur GÜNCELLİĞİ — saf karar mantığı.
 *
 * Neden ayrı ve testli: "kurlar güncel mi" sorusu göründüğünden zor. Kaynaklar
 * (ECB, TCMB) yalnız İŞ GÜNÜ yayımlar; cumartesi sabahı en taze kur cuma
 * tarihlidir ve bu NORMALDİR. Naif bir "rateDate === bugün" kontrolü her hafta
 * sonu yanlış alarm verirdi — kullanıcı gerçek bir sorun olmadığı hâlde
 * kurlarının bozuk olduğunu sanardı ve zamanla uyarıyı tümden yok sayardı.
 */

export type FreshnessLevel = 'fresh' | 'stale' | 'unknown'

export interface Freshness {
  level: FreshnessLevel
  /** Kur tarihinin bugüne uzaklığı (takvim günü). null = hesaplanamadı. */
  ageDays: number | null
}

/** Bir kur tarihi kaç İŞ GÜNÜ bayat sayılırsa uyarılır. */
const STALE_BUSINESS_DAYS = 2

function toUtcDay(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000)
}

function parseDay(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m)
    return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * `from` ile `to` arasındaki İŞ GÜNÜ sayısı (from hariç, to dahil).
 * Hafta sonu sayılmaz — tatil takvimi YOK (ülkeye göre değişir, ekstra bağımlılık
 * getirir); bu yüzden eşik cömert tutulur, resmi tatiller yanlış alarm üretmesin.
 */
function businessDaysBetween(from: Date, to: Date): number {
  let n = 0
  const cur = new Date(from)
  while (toUtcDay(cur) < toUtcDay(to)) {
    cur.setDate(cur.getDate() + 1)
    const wd = cur.getDay()
    if (wd !== 0 && wd !== 6) // 0=Pazar, 6=Cumartesi
      n++
  }
  return n
}

/**
 * @param rateDate Kaynağın kendi kur tarihi (yyyy-MM-dd). null = bilinmiyor.
 * @param now Şimdi (test edilebilirlik için enjekte edilir).
 */
export function rateFreshness(rateDate: string | null, now: Date = new Date()): Freshness {
  if (!rateDate)
    return { level: 'unknown', ageDays: null }

  const d = parseDay(rateDate)
  if (!d)
    return { level: 'unknown', ageDays: null }

  const ageDays = toUtcDay(now) - toUtcDay(d)
  // Gelecek tarihli kur (saat dilimi kayması/bozuk veri) → bayat sayma.
  if (ageDays < 0)
    return { level: 'fresh', ageDays }

  const business = businessDaysBetween(d, now)
  return { level: business >= STALE_BUSINESS_DAYS ? 'stale' : 'fresh', ageDays }
}
