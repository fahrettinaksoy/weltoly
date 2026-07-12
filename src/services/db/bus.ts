// Tablo-değişikliği olay veri yolu. PowerSync'in yerleşik `watch`'u olmadığından,
// mutasyonlar ilgili tabloyu bu yol üzerinden bildirir; watchTable aboneleri yeniden sorgular.

type Listener = () => void

const listeners = new Map<string, Set<Listener>>()

/** Verilen tablolardan herhangi biri değiştiğinde `fn`'i çağır. Abonelikten çıkış fonksiyonu döndürür. */
export function onTableChange(tables: string[], fn: Listener): () => void {
  for (const t of tables) {
    let set = listeners.get(t)
    if (!set) {
      set = new Set()
      listeners.set(t, set)
    }
    set.add(fn)
  }
  return () => {
    for (const t of tables)
      listeners.get(t)?.delete(fn)
  }
}

/** Bir veya daha fazla tablonun değiştiğini bildir (her dinleyici çağrı başına en fazla bir kez). */
export function emitTableChange(...tables: string[]): void {
  const notified = new Set<Listener>()
  for (const t of tables) {
    const set = listeners.get(t)
    if (!set)
      continue
    for (const fn of set) {
      if (notified.has(fn))
        continue
      notified.add(fn)
      fn()
    }
  }
}
