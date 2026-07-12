import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'

// Uygulama içi PIN kilidi (kolaylık amaçlı; veri şifreleme DEĞİL — o Faz 5+ senkron/güvenlik).
const SALT = 'weltoly.pin.v1'

async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(SALT + pin))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export const useLockStore = defineStore('lock', () => {
  const pinHash = useLocalStorage<string>('weltoly.pinHash', '')
  const hasPin = computed(() => pinHash.value.length > 0)

  // PIN varsa uygulama kilitli başlar.
  const isLocked = ref(hasPin.value)

  async function setPin(pin: string): Promise<void> {
    pinHash.value = await hashPin(pin)
    isLocked.value = false
  }

  function removePin(): void {
    pinHash.value = ''
    isLocked.value = false
  }

  async function verifyPin(pin: string): Promise<boolean> {
    if (!hasPin.value)
      return false
    return (await hashPin(pin)) === pinHash.value
  }

  function lock(): void {
    if (hasPin.value)
      isLocked.value = true
  }

  function unlock(): void {
    isLocked.value = false
  }

  return { hasPin, isLocked, setPin, removePin, verifyPin, lock, unlock }
})
