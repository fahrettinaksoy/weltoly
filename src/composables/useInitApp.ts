import { isTauriRuntime } from '@/services/db'
import { refreshRates } from '@/services/rates'
import { useUserStore } from '@/features/user/store'
import { useCurrenciesStore } from '@/features/currencies/store'
import { useCategoriesStore } from '@/features/categories/store'
import { useWalletsStore } from '@/features/wallets/store'
import { useTrnsStore } from '@/features/trns/store'
import { useTagsStore } from '@/features/tags/store'

/**
 * Uygulama açılışında tüm store watch'larını (yerel SQLite abonelikleri) başlatır.
 * Yalnız Tauri runtime'ında çalışır; saf tarayıcıda (`npm run dev`) SQLite yoktur.
 */
export function useInitApp() {
  const userStore = useUserStore()
  const currenciesStore = useCurrenciesStore()
  const categoriesStore = useCategoriesStore()
  const walletsStore = useWalletsStore()
  const trnsStore = useTrnsStore()
  const tagsStore = useTagsStore()

  function init() {
    if (!isTauriRuntime()) {
      console.info('[app] Tauri dışı ortam - yerel SQLite atlandı (npm run tauri:dev ile çalıştırın).')
      return
    }
    userStore.initUserSettings()
    currenciesStore.initCurrencies()
    categoriesStore.initCategories()
    walletsStore.initWallets()
    trnsStore.initTrns()
    tagsStore.initTags()

    // Günlük kurları arka planda tazele (offline'da sessizce atlar).
    refreshRates().catch(() => {})
  }

  return { init }
}
