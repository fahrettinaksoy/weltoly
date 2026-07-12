import { defineStore } from 'pinia'

import { resolveWriteUid, upsertRow, watchTable, type Row, type WatchHandle } from '@/services/db'

import type { CurrencyCode } from '@/features/currencies/types'

// Yerel-önce: gerçek kimlik yok, sabit 'local' kullanıcı. user_settings tek satır ('local').
// Faz 5'te gerçek auth buraya bağlanacak.
export const useUserStore = defineStore('user', () => {
  const baseCurrency = ref<CurrencyCode>('USD')
  const locale = ref<string>('tr')
  const uid = computed(() => resolveWriteUid(null))

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
    })
  }

  function setUserBaseCurrency(value: CurrencyCode) {
    baseCurrency.value = value
  }

  function saveUserBaseCurrency(value: CurrencyCode) {
    setUserBaseCurrency(value)
    upsertRow('user_settings', uid.value, {
      baseCurrency: value,
      locale: locale.value,
      userId: uid.value,
    }).catch(e => console.error('[user] saveUserBaseCurrency failed', e))
  }

  return {
    baseCurrency,
    locale,
    uid,
    initUserSettings,
    setUserBaseCurrency,
    saveUserBaseCurrency,
  }
})
