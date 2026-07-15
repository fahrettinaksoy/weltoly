import { onScopeDispose, shallowRef, watchEffect } from 'vue'

/**
 * Sayfalar, içerik kartının başlık şeridine bağlamsal eylem butonu yerleştirir:
 * liste sayfalarında "Yeni cüzdan", detayda "Düzenle" / "Sil" gibi.
 * Başlık zaten hero bandında; kart şeridi yalnız eylemler içindir.
 */
export type AppBarActionDef = {
  icon: string
  /** Buton metni. Dar ekranda gizlenir, aria-label olarak kalır. */
  label: string
  onClick: () => void
  /** Varsayılan: primary. Yıkıcı eylemlerde 'error'. */
  color?: string
  /** Varsayılan: 'tonal'. İkincil eylemlerde 'text'. */
  variant?: 'tonal' | 'text' | 'flat'
}

const current = shallowRef<AppBarActionDef[]>([])

/**
 * Bu sayfanın eylemlerini ayarla; sayfa (scope) kapanınca temizlenir.
 *
 * Getter alır çünkü eylemler duruma göre değişir — ör. detaydaki yıldız,
 * cüzdan varsayılan oldukça dolu/boş arasında geçer. Düz obje alsaydık
 * ilk render'da donardı.
 */
export function useAppBarAction(actions: () => AppBarActionDef | AppBarActionDef[]) {
  watchEffect(() => {
    const value = actions()
    current.value = Array.isArray(value) ? value : [value]
  })
  onScopeDispose(() => {
    current.value = []
  })
}

/** DefaultLayout okur. */
export function appBarActions() {
  return current
}
