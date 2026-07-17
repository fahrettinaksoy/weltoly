/* eslint-disable no-console -- Bu modül projenin TEK yetkili console sarmalayıcısıdır;
   info/debug dahil tüm seviyeleri BİLEREK kullanır. Başka yerde console yasak kalır. */
import { debug as sinkDebug, error as sinkError, info as sinkInfo, warn as sinkWarn } from '@tauri-apps/plugin-log'

import { isTauriRuntime } from '@/services/db/client'

// Projenin TEK log kanalı. `console.*` yerine bunu kullan:
//   - Tauri içinde: hem console'a (geliştirme görünürlüğü) HEM app log dizinindeki
//     dönen dosyaya yazar (lib.rs → tauri-plugin-log). Yerel-önce/gizlilik odaklı
//     uygulamada uzak telemetri yok; kullanıcı bir çöküş bildirdiğinde teşhis
//     edilecek TEK kalıcı kaynak bu dosyadır.
//   - Saf tarayıcıda (`npm run dev`, Tauri yok): yalnız console — plugin IPC'si
//     olmadığı için dosya sink'i sessizce atlanır.

type Sink = (message: string) => Promise<void>

/** console gibi değişken argümanları tek satıra indirger; Error'ı stack'iyle korur. */
function serialize(arg: unknown): string {
  if (arg instanceof Error)
    return arg.stack || `${arg.name}: ${arg.message}`
  if (typeof arg === 'string')
    return arg
  try {
    return JSON.stringify(arg)
  }
  catch {
    // Döngüsel/serileştirilemeyen değer — en azından tipini yaz.
    return String(arg)
  }
}

function persist(sink: Sink, args: unknown[]): void {
  if (!isTauriRuntime())
    return
  // Sink'in KENDİ hatası yutulur — log'lamayı log'lamak sonsuz döngü olurdu.
  void sink(args.map(serialize).join(' ')).catch(() => {})
}

export const logger = {
  error: (...args: unknown[]): void => {
    console.error(...args)
    persist(sinkError, args)
  },
  warn: (...args: unknown[]): void => {
    console.warn(...args)
    persist(sinkWarn, args)
  },
  info: (...args: unknown[]): void => {
    console.info(...args)
    persist(sinkInfo, args)
  },
  debug: (...args: unknown[]): void => {
    console.debug(...args)
    persist(sinkDebug, args)
  },
}
