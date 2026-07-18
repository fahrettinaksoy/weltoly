// PIN kilidi için saf kripto + backoff yardımcıları (UI/store'dan bağımsız → test edilebilir).

export const PBKDF2_ITER = 210_000
export const NEW_MIN_LEN = 6 // yeni PIN'ler için asgari uzunluk
export const LEGACY_SALT = 'weltoly.pin.v1'

// Backoff: ilk FREE deneme cezasız; sonrası üstel (5s, 10s, 20s ... 15dk tavan).
export const FREE_ATTEMPTS = 4
export const BACKOFF_BASE_MS = 5_000
export const BACKOFF_MAX_MS = 15 * 60 * 1000

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function randomSaltHex(): string {
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
}

export async function pbkdf2Hex(pin: string, saltHex: string, iter: number): Promise<string> {
  const salt = Uint8Array.from(saltHex.match(/.{2}/g)!.map((h) => Number.parseInt(h, 16)))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveBits'
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
    key,
    256
  )
  return toHex(bits)
}

export async function legacyHashHex(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(LEGACY_SALT + pin))
  return toHex(buf)
}

/** fails başarısız denemeden sonra beklenmesi gereken süre (ms). 0 = ceza yok. */
export function backoffMs(fails: number): number {
  if (fails <= FREE_ATTEMPTS) return 0
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** (fails - FREE_ATTEMPTS - 1))
}
