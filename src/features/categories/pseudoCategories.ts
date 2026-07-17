/**
 * SENTETİK (pseudo) kategori KİMLİKLERİ — TEK KAYNAK (O-10).
 *
 * `transfer` ve `adjustment` kullanıcının oluşturduğu kategoriler DEĞİLDİR;
 * `categories` tablosunda satırları yoktur. İşlemin doğasını belirten sabit
 * işaretlerdir:
 *  - transfer   : iki cüzdan arasında para taşıma (gelir/gider değil)
 *  - adjustment : cüzdan bakiyesini gerçeğe çekme (açılış bakiyesi, faiz vb.)
 *
 * Bu modül BİLİNÇLİ OLARAK SAFTIR — i18n/store/Vue import ETMEZ. Sebep:
 * getTotal gibi saf hesap modülleri ve testleri bu sabitlere ihtiyaç duyuyor;
 * i18n'i buraya bağlamak `plugins/i18n` üzerinden localStorage'ı modül yükleme
 * anında çağırır ve node test ortamını patlatır. Görünen ADLAR (çeviri gerektirir)
 * ayrı modülde: `pseudoCategoryItem.ts`.
 */

/** Sentetik kategori id sabitleri — sihirli string yerine bunları kullan. */
export const TRANSFER_ID = 'transfer' as const
export const ADJUSTMENT_ID = 'adjustment' as const

export const PSEUDO_CATEGORY_IDS = [TRANSFER_ID, ADJUSTMENT_ID] as const
export type PseudoCategoryId = typeof PSEUDO_CATEGORY_IDS[number]

export function isPseudoCategoryId(id: unknown): id is PseudoCategoryId {
  return id === TRANSFER_ID || id === ADJUSTMENT_ID
}

export const PSEUDO_ICONS: Record<PseudoCategoryId, string> = {
  [TRANSFER_ID]: 'mdi-swap-horizontal',
  [ADJUSTMENT_ID]: 'mdi-scale-balance',
}

/** i18n anahtarları (walletDetail bölümünde tr/en/ru üçünde de tanımlı). */
export const PSEUDO_LABEL_KEYS: Record<PseudoCategoryId, string> = {
  [TRANSFER_ID]: 'walletDetail.transfer',
  [ADJUSTMENT_ID]: 'walletDetail.adjustment',
}
