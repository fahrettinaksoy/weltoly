<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import PinPad from '@/features/auth/PinPad.vue'
import { useLockStore } from '@/features/auth/useLockStore'

const { t } = useI18n()
const lock = useLockStore()
const pad = ref<InstanceType<typeof PinPad>>()
const error = ref(false)

// Backoff geri sayımı için saniyede bir tazelenen "şimdi".
const now = useNow({ interval: 1000 })
const remainingMs = computed(() => Math.max(0, lock.lockedUntil - now.value.getTime()))
const throttled = computed(() => remainingMs.value > 0)
const remainingSec = computed(() => Math.ceil(remainingMs.value / 1000))

async function onComplete(pin: string) {
  if (throttled.value) {
    pad.value?.reset()
    return
  }
  if (await lock.verifyPin(pin)) {
    lock.unlock()
    return
  }
  error.value = true
  setTimeout(() => {
    error.value = false
    pad.value?.reset()
  }, 400)
}
</script>

<template>
  <!-- theme-provider: kilit ekranı uygulama teması ne olursa olsun her zaman koyu. -->
  <v-theme-provider theme="dark">
    <div class="lock-screen">
      <v-icon icon="$lock" size="40" color="primary" class="mb-4" />
      <PinPad
        ref="pad"
        :title="t('lock.title')"
        :subtitle="throttled ? t('lock.lockedFor', { s: remainingSec }) : t('lock.subtitle')"
        :length="lock.pinLength"
        :error="error"
        :disabled="throttled"
        @complete="onComplete"
      />
    </div>
  </v-theme-provider>
</template>

<style scoped>
.lock-screen {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgb(var(--v-theme-background));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
</style>
