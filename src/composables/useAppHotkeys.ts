import { useHotkey } from 'vuetify'
import { useRouter } from 'vue-router'

import { useTrnsFormStore } from '@/features/trnForm/store'

/**
 * Global klavye kısayolları (hotkey feature). Vuetify `useHotkey` kullanır —
 * girdi alanlarında tetiklenmez (inputs: false varsayılan), scope kapanınca temizlenir.
 *
 * n          → yeni işlem
 * g sonra d/w/c/s/e → sayfalar arası gezinme (dizi)
 * shift+/    → kısayol yardımı
 */
export function useAppHotkeys() {
  const router = useRouter()
  const trnForm = useTrnsFormStore()
  const showHelp = ref(false)

  useHotkey('n', () => trnForm.openFormForCreate())
  useHotkey('g-d', () => router.push('/dashboard'))
  useHotkey('g-w', () => router.push('/wallets'))
  useHotkey('g-c', () => router.push('/categories'))
  useHotkey('g-s', () => router.push('/stat'))
  useHotkey('g-e', () => router.push('/settings'))
  useHotkey('shift+/', () => { showHelp.value = !showHelp.value })

  return { showHelp }
}
