import { appLogDir } from '@tauri-apps/api/path'
import { revealItemInDir } from '@tauri-apps/plugin-opener'

import { isTauriRuntime } from '@/services/db/client'
import { logger } from '@/shared/lib/logger'

/**
 * Tanılama: log dosyalarının bulunduğu klasörü işletim sisteminin dosya
 * yöneticisinde açar (revealItemInDir — opener:default'ta zaten izinli).
 *
 * Uzak telemetri OLMADIĞI için kullanıcının çöküş sonrası paylaşabileceği tek
 * şey bu dosyalardır; onlara ulaşmanın kullanıcı-dostu yolu budur.
 *
 * @returns Açıldıysa true; Tauri dışıysa (saf tarayıcı) veya hata olursa false.
 */
export async function revealLogs(): Promise<boolean> {
  if (!isTauriRuntime()) return false
  try {
    await revealItemInDir(await appLogDir())
    return true
  } catch (e) {
    logger.error('[diagnostics] log klasörü açılamadı', e)
    return false
  }
}
