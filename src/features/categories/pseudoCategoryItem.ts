import type { PseudoCategoryId } from '@/features/categories/pseudoCategories'
import type { CategoryId, CategoryItem } from '@/features/categories/types'
import {
  isPseudoCategoryId,
  PSEUDO_ICONS,
  PSEUDO_LABEL_KEYS,
} from '@/features/categories/pseudoCategories'
import { i18n } from '@/plugins/i18n'

/**
 * Sentetik kategorilerin GÖRÜNEN hâli (O-10).
 *
 * Ayrı modül: i18n'e (dolayısıyla localStorage'a) bağımlı olduğu için saf
 * `pseudoCategories.ts` ile birleştirilemez — birleşseydi getTotal gibi saf
 * modüller onu import ettiğinde node testleri modül yükleme anında patlardı.
 *
 * Adlar ÇEVİRİDEN gelir: eskiden trns/store.ts içine `'Transfer'` / `'Adjustment'`
 * diye İngilizce gömülüydü ve Türkçe/Rusça arayüzde bile İngilizce görünüyordu.
 */
export function getPseudoCategory(id: PseudoCategoryId): CategoryItem {
  return {
    color: '',
    desc: '',
    icon: PSEUDO_ICONS[id],
    name: i18n.global.t(PSEUDO_LABEL_KEYS[id]),
    parentId: 0,
    showInLastUsed: false,
    showInQuickSelector: false,
  }
}

/** Verilen id sentetikse CategoryItem'ını, değilse null döner. */
export function resolvePseudoCategory(id: CategoryId): CategoryItem | null {
  return isPseudoCategoryId(id) ? getPseudoCategory(id) : null
}
