import { onScopeDispose, shallowRef } from 'vue'

// Sayfalar, üst çubuğa (app-bar) bağlamsal bir eylem butonu (ör. "+") yerleştirir.
// Başlık zaten app-bar'da; sayfa içi tekrar başlık gerekmez.
export type AppBarActionDef = { icon: string, onClick: () => void }

const current = shallowRef<AppBarActionDef | null>(null)

/** Bu sayfa için app-bar eylemini ayarla; sayfa (scope) kapanınca temizlenir. */
export function useAppBarAction(action: AppBarActionDef) {
  current.value = action
  onScopeDispose(() => {
    if (current.value === action)
      current.value = null
  })
}

/** DefaultLayout okur. */
export function appBarAction() {
  return current
}
