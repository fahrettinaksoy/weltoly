import { isTauriRuntime } from '@/services/db'
import { useUserStore } from '@/features/user/store'
import { useCurrenciesStore } from '@/features/currencies/store'
import { useCategoriesStore } from '@/features/categories/store'
import { useWalletsStore } from '@/features/wallets/store'
import { useTrnsStore } from '@/features/trns/store'

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
  }

  return { init }
}
