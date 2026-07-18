// Merkezi para aritmetiği — K-1.
//
// SORUN: Tutarlar IEEE-754 double. Ham `+`/`-` ile üst üste toplayınca
// `0.1 + 0.2 = 0.30000000000000004` sınıfı hata YÜZLERCE işlemde kuruş düzeyinde
// birikir; net varlık, kredi limiti ve grafik tabanı bu hatayı taşır.
//
// ÇÖZÜM (bu katman): her toplama/çıkarma adımında sonucu sabit bir minor-unit
// ızgarasına (varsayılan 8 ondalık — kripto satoshi) YUVARLA. Böylece ara
// sonuçlar hep ızgarada kalır, tail birikmez. Ham `+`/`-` yerine bu yardımcılar
// kullanılmalı.
//
// NOT (mimari borç): İdeal çözüm parayı DB'de INTEGER minor-unit saklamaktır
// (REAL yerine). O migrasyon veri dönüşümü + geniş dokunuş gerektirir ve ayrı
// bir iş olarak planlanmıştır. Bu katman, o migrasyona kadar birikmeli float
// hatasını pratikte ortadan kaldırır ve gelecekteki geçişin tek noktası olur.

export const MONEY_SCALE = 8 // desteklenen azami ondalık (kripto)
const FACTOR = 10 ** MONEY_SCALE

/** n'i `decimals` ondalığa yuvarlar (yarı-yukarı, EPSILON ile ikili-temsil düzeltmesi). */
export function roundMoney(n: number, decimals: number = MONEY_SCALE): number {
  if (!Number.isFinite(n)) return 0
  const f = 10 ** decimals
  return Math.round((n + Number.EPSILON * Math.sign(n)) * f) / f
}

/** Yuvarlama-güvenli toplama (a + b), sonuç minor-unit ızgarasına snap'lenir. */
export function addMoney(a: number, b: number): number {
  return Math.round(a * FACTOR + b * FACTOR) / FACTOR
}

/** Yuvarlama-güvenli çıkarma (a - b). */
export function subMoney(a: number, b: number): number {
  return Math.round(a * FACTOR - b * FACTOR) / FACTOR
}

/**
 * Bir dizi tutarı tamsayı minor-unit'te toplar → tail birikmez.
 * (Uyarı: |toplam| < ~9·10^7 için güvenli; 8 ondalıkta 2^53 sınırı budur.)
 */
export function sumMoney(values: Iterable<number>): number {
  let acc = 0
  for (const v of values) {
    if (Number.isFinite(v)) acc += Math.round(v * FACTOR)
  }
  return acc / FACTOR
}
