import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'

import { resolveWriteUid, upsertRow, watchTable, type Row, type WatchHandle } from '@/services/db'
import { showErrorToast } from '@/stores/ui'

import type { CurrencyCode } from '@/features/currencies/types'
import type { WalletId } from '@/features/wallets/types'

// Yerel-önce: gerçek kimlik yok, sabit 'local' kullanıcı. user_settings tek satır ('local').
// Faz 5'te gerçek auth buraya bağlanacak.
export const useUserStore = defineStore('user', () => {
  const baseCurrency = ref<CurrencyCode>('USD')
  const locale = ref<string>('tr')
  /** Yeni işlem formunda önceden seçili gelen cüzdan. null = ilk cüzdana düş. */
  const defaultWalletId = ref<WalletId | null>(null)
  const displayName = useLocalStorage<string>('weltoly.displayName', '')
  const uid = computed(() => resolveWriteUid(null))

  function setDisplayName(name: string) {
    displayName.value = name.trim()
  }

  let watchController: WatchHandle | null = null

  function initUserSettings(): void {
    watchController?.abort()
    watchController = watchTable<Row>('SELECT * FROM user_settings LIMIT 1', [], (rows) => {
      const s = rows[0]
      if (!s)
        return
      if (s.baseCurrency)
        baseCurrency.value = s.baseCurrency
      if (s.locale)
        locale.value = s.locale
      // 004 öncesi satırlarda kolon yok/null → null'a düşer (ilk cüzdan kullanılır)
      defaultWalletId.value = (s.defaultWalletId as WalletId | null) ?? null
    })
  }

  function setUserBaseCurrency(value: CurrencyCode) {
    baseCurrency.value = value
  }

  /**
   * user_settings tek satırdır; upsert YALNIZ verilen kolonları günceller
   * (ON CONFLICT DO UPDATE SET ... excluded). Yine de tüm alanları birlikte
   * yazıyoruz: satır henüz yoksa INSERT eksik alanları null bırakırdı.
   */
  function saveSettingsRow() {
    return upsertRow('user_settings', uid.value, {
      baseCurrency: baseCurrency.value,
      locale: locale.value,
      defaultWalletId: defaultWalletId.value,
      userId: uid.value,
    })
  }

  function saveUserBaseCurrency(value: CurrencyCode) {
    setUserBaseCurrency(value)
    saveSettingsRow().catch(e => console.error('[user] saveUserBaseCurrency failed', e))
  }

  /** Varsayılan cüzdanı ayarla. Aynısına basılırsa seçim kaldırılır (null). */
  function saveDefaultWalletId(value: WalletId | null) {
    const prev = defaultWalletId.value
    defaultWalletId.value = value
    saveSettingsRow().catch((e) => {
      defaultWalletId.value = prev
      console.error('[user] saveDefaultWalletId failed', e)
      showErrorToast('wallets.errors.saveFailed')
    })
  }

  return {
    baseCurrency,
    defaultWalletId,
    locale,
    displayName,
    uid,
    initUserSettings,
    saveDefaultWalletId,
    setDisplayName,
    setUserBaseCurrency,
    saveUserBaseCurrency,
  }
})
