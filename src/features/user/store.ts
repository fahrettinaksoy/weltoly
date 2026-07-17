import type { RateSourceKey } from '@/features/currencies/sources'
import type { CurrencyCode } from '@/features/currencies/types'
import type { WalletId } from '@/features/wallets/types'

import type { Row, WatchHandle } from '@/services/db'
import { useLocalStorage } from '@vueuse/core'

import { defineStore } from 'pinia'
import { DEFAULT_RATE_SOURCE, isRateSourceKey } from '@/features/currencies/sources'
import { resolveWriteUid, upsertRow, watchTable } from '@/services/db'
import { showErrorToast } from '@/stores/ui'

// Yerel-önce: gerçek kimlik yok, sabit 'local' kullanıcı. user_settings tek satır ('local').
// Faz 5'te gerçek auth buraya bağlanacak.
// `locale` BİLİNÇLİ OLARAK BURADA DEĞİL (B-4). SQLite'ta `user_settings.locale`
// kolonu var ve burada bir ref'e okunuyordu, ama HİÇBİR TÜKETİCİSİ YOKTU: uygulama
// dili baştan sona `stores/settings.ts` (localStorage) üzerinden akıyor. Üstelik
// setter'ı da yoktu — kullanıcı dili değiştirse bile SQLite sonsuza dek ilk değerde
// (`'tr'`) kalırdı. Yani "kaynak" gibi duran ama hep bayat olan bir kopyaydı: bir
// dil hatasını düzeltmeye kalkan buradaki değeri değiştirip hiçbir etki göremezdi.
// Faz 5'te dilin cihazlar arası senkronu istenirse, o zaman GERÇEK bir setter'la
// eklenmeli; ölü kolonu yazmaya devam etmek bayat değeri karşı tarafa taşırdı.
// Kolon şemada duruyor (nullable, yazılmıyor) — kaldırmak tablo yeniden inşası ister.
export const useUserStore = defineStore('user', () => {
  const baseCurrency = ref<CurrencyCode>('USD')
  /** Yeni işlem formunda önceden seçili gelen cüzdan. null = ilk cüzdana düş. */
  const defaultWalletId = ref<WalletId | null>(null)
  /**
   * Fiat kurlarının çekileceği kaynak. Kripto BUNA BAĞLI DEĞİL — her zaman
   * CoinGecko'dan gelir (üç fiat kaynağının hiçbiri kripto vermiyor).
   */
  const rateSource = ref<RateSourceKey>(DEFAULT_RATE_SOURCE)
  const displayName = useLocalStorage<string>('weltoly.displayName', '')
  const uid = computed(() => resolveWriteUid(null))

  function setDisplayName(name: string) {
    displayName.value = name.trim()
  }

  let watchController: WatchHandle | null = null

  function initUserSettings(): void {
    watchController?.abort()
    watchController = watchTable<Row>(['user_settings'], 'SELECT * FROM user_settings LIMIT 1', [], (rows) => {
      const s = rows[0]
      if (!s)
        return
      if (s.baseCurrency)
        baseCurrency.value = s.baseCurrency
      // 004 öncesi satırlarda kolon yok/null → null'a düşer (ilk cüzdan kullanılır)
      defaultWalletId.value = (s.defaultWalletId as WalletId | null) ?? null
      // 006 öncesi satırlarda kolon yok/null → varsayılan kaynak.
      // isRateSourceKey: DB'de tanınmayan bir değer varsa (elle düzenleme,
      // eski sürümden kalma) sessizce ona güvenme.
      rateSource.value = isRateSourceKey(s.rateSource) ? s.rateSource : DEFAULT_RATE_SOURCE
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
      defaultWalletId: defaultWalletId.value,
      rateSource: rateSource.value,
      userId: uid.value,
    })
  }

  function saveUserBaseCurrency(value: CurrencyCode) {
    setUserBaseCurrency(value)
    saveSettingsRow().catch(e => console.error('[user] saveUserBaseCurrency failed', e))
  }

  /**
   * Kur kaynağını değiştir. Yazma başarısızsa geri al — ekranda seçili görünüp
   * DB'de eski kalması, kullanıcının başka bir kaynaktan çekildiğini sanmasına
   * yol açardı.
   */
  function saveRateSource(value: RateSourceKey) {
    const prev = rateSource.value
    rateSource.value = value
    return saveSettingsRow().catch((e) => {
      rateSource.value = prev
      console.error('[user] saveRateSource failed', e)
      showErrorToast('settings.rateSourceSaveFailed')
    })
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
    rateSource,
    saveRateSource,
    displayName,
    uid,
    initUserSettings,
    saveDefaultWalletId,
    setDisplayName,
    setUserBaseCurrency,
    saveUserBaseCurrency,
  }
})
