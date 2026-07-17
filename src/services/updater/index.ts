import { relaunch } from '@tauri-apps/plugin-process'
import { check } from '@tauri-apps/plugin-updater'

import { isTauriRuntime } from '@/services/db/client'
import { logger } from '@/shared/lib/logger'

export type UpdateOutcome
  = | 'updated' // güncelleme kuruldu, yeniden başlatılıyor
    | 'none' // zaten en güncel
    | 'unsupported' // Tauri dışı ortam (saf tarayıcı) veya masaüstü değil
    | 'error' // ağ/imza/kurulum hatası (loglandı)

/**
 * Güncelleme var mı bakar; varsa imzalı paketi indirip kurar ve uygulamayı
 * yeniden başlatır. İmza doğrulaması plugin tarafında tauri.conf'taki `pubkey`
 * ile yapılır — imzasız/kurcalanmış paket reddedilir.
 *
 * Yalnız masaüstünde anlamlıdır (mobil mağaza kendi günceller); Tauri dışında
 * `unsupported` döner.
 */
export async function checkForUpdates(): Promise<UpdateOutcome> {
  if (!isTauriRuntime())
    return 'unsupported'
  try {
    const update = await check()
    if (!update)
      return 'none'

    logger.info(`[updater] ${update.version} bulundu, indiriliyor…`)
    await update.downloadAndInstall()
    // Yeniden başlatma yeni sürümü yükler. relaunch dönmeden süreç değişir.
    await relaunch()
    return 'updated'
  }
  catch (e) {
    logger.error('[updater] güncelleme kontrolü/kurulumu başarısız', e)
    return 'error'
  }
}
