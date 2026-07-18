import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

import {
  backoffMs,
  legacyHashHex,
  NEW_MIN_LEN,
  PBKDF2_ITER,
  pbkdf2Hex,
  randomSaltHex
} from './pinCrypto'

// Uygulama içi PIN kilidi.
//
// ⚠️ DÜRÜST BEKLENTİ: Bu kilit yalnızca EKRAN/GÖSTERİM kilididir; disk üzerindeki
// SQLite verisini ŞİFRELEMEZ. Cihaza fiziksel erişimi olan biri DB dosyasını
// doğrudan okuyabilir. Gerçek at-rest gizlilik Faz 5+ (SQLCipher/stronghold) işidir.
//
// Yine de kilit "kozmetik" olmaktan çıkarıldı:
//  - Hash artık PBKDF2 (yüksek iterasyon) + cihaza özgü RASTGELE salt (koda gömülü değil).
//  - Kalıcı başarısız-deneme sayacı + üstel backoff (brute-force zorlaştırma).
//  - Kilitliyken layout DOM'dan tümüyle kaldırılır (App.vue v-if) — veri render edilmez.

const REC_KEY = 'weltoly.pin' // v2 kayıt (JSON)
const LEGACY_KEY = 'weltoly.pinHash' // v1: düz SHA-256 hex (4 haneli, koda gömülü salt)
const ATTEMPTS_KEY = 'weltoly.pinAttempts'

interface PinRecord {
  v: 2
  salt: string
  iter: number
  hash: string
  len: number
}
interface Attempts {
  fails: number
  lockedUntil: number
}

export const useLockStore = defineStore('lock', () => {
  const recordRaw = useLocalStorage<string>(REC_KEY, '')
  const legacyHash = useLocalStorage<string>(LEGACY_KEY, '')
  const attempts = useLocalStorage<Attempts>(ATTEMPTS_KEY, { fails: 0, lockedUntil: 0 })

  const record = computed<PinRecord | null>(() => {
    if (!recordRaw.value) return null
    try {
      const r = JSON.parse(recordRaw.value)
      return r && r.v === 2 && typeof r.hash === 'string' ? (r as PinRecord) : null
    } catch {
      return null
    }
  })

  const hasPin = computed(() => !!record.value || legacyHash.value.length > 0)
  // Kilit ekranı kaç hane beklemeli: v2 kaydından, eski hash için 4, yoksa yeni asgari.
  const pinLength = computed(() => record.value?.len ?? (legacyHash.value ? 4 : NEW_MIN_LEN))

  // PIN varsa uygulama kilitli başlar.
  const isLocked = ref(hasPin.value)

  // Backoff durumu (UI reaktif tüketir; LockScreen bir zamanlayıcıyla tazeler).
  const lockedUntil = computed(() => attempts.value.lockedUntil)

  async function setPin(pin: string): Promise<void> {
    if (pin.length < NEW_MIN_LEN) throw new Error(`PIN en az ${NEW_MIN_LEN} haneli olmalı`)
    const salt = randomSaltHex()
    const hash = await pbkdf2Hex(pin, salt, PBKDF2_ITER)
    const rec: PinRecord = { v: 2, salt, iter: PBKDF2_ITER, hash, len: pin.length }
    recordRaw.value = JSON.stringify(rec)
    legacyHash.value = '' // varsa eski format kaydını temizle
    attempts.value = { fails: 0, lockedUntil: 0 }
    isLocked.value = false
  }

  function removePin(): void {
    recordRaw.value = ''
    legacyHash.value = ''
    attempts.value = { fails: 0, lockedUntil: 0 }
    isLocked.value = false
  }

  /** Sadece hash karşılaştırması (deneme sayacına DOKUNMAZ). Değişim/kaldırma doğrulaması için. */
  async function matchesPin(pin: string): Promise<boolean> {
    const rec = record.value
    if (rec) return (await pbkdf2Hex(pin, rec.salt, rec.iter)) === rec.hash
    if (legacyHash.value) return (await legacyHashHex(pin)) === legacyHash.value
    return false
  }

  /** Kilit açma denemesi: backoff'u uygular, başarıda eski format'ı v2'ye yükseltir. */
  async function verifyPin(pin: string): Promise<boolean> {
    if (!hasPin.value) return false
    // Kilit süresi dolmadıysa denemeyi reddet.
    if (Date.now() < attempts.value.lockedUntil) return false

    const ok = await matchesPin(pin)
    if (ok) {
      // Eski format ile açıldıysa aynı PIN'i v2'ye taşı (kademeli sertleştirme).
      if (!record.value && legacyHash.value) {
        const salt = randomSaltHex()
        const hash = await pbkdf2Hex(pin, salt, PBKDF2_ITER)
        recordRaw.value = JSON.stringify({
          v: 2,
          salt,
          iter: PBKDF2_ITER,
          hash,
          len: pin.length
        } satisfies PinRecord)
        legacyHash.value = ''
      }
      attempts.value = { fails: 0, lockedUntil: 0 }
      return true
    }

    const fails = attempts.value.fails + 1
    const wait = backoffMs(fails)
    attempts.value = { fails, lockedUntil: wait ? Date.now() + wait : 0 }
    return false
  }

  /** Mevcut PIN doğrulanmadan değiştirilemez (O-13). */
  async function changePin(current: string, next: string): Promise<boolean> {
    if (hasPin.value && !(await matchesPin(current))) return false
    await setPin(next)
    return true
  }

  function lock(): void {
    if (hasPin.value) isLocked.value = true
  }

  function unlock(): void {
    isLocked.value = false
  }

  return {
    hasPin,
    isLocked,
    pinLength,
    lockedUntil,
    setPin,
    removePin,
    verifyPin,
    matchesPin,
    changePin,
    lock,
    unlock
  }
})
