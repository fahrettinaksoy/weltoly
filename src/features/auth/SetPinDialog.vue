<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import PinPad from '@/features/auth/PinPad.vue'
import { useLockStore } from '@/features/auth/useLockStore'
import { useUiStore } from '@/stores/ui'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const NEW_LEN = 6

const { t } = useI18n()
const lock = useLockStore()
const ui = useUiStore()

const pad = ref<InstanceType<typeof PinPad>>()
// 'current': mevcut PIN'i doğrula (yalnız zaten PIN varsa) → sonra 'enter' → 'confirm'.
type Step = 'current' | 'enter' | 'confirm'
const step = ref<Step>('enter')
const first = ref('')
const error = ref(false)

function resetFlow() {
  step.value = lock.hasPin ? 'current' : 'enter'
  first.value = ''
  error.value = false
  pad.value?.reset()
}

watch(() => props.modelValue, (open) => {
  if (open)
    resetFlow()
})

// Adıma göre beklenen uzunluk: mevcut PIN'de kayıtlı uzunluk, yenilerde NEW_LEN.
const activeLength = computed(() => (step.value === 'current' ? lock.pinLength : NEW_LEN))

const title = computed(() => {
  if (step.value === 'current')
    return t('lock.enterCurrent')
  return step.value === 'enter' ? t('lock.enterNew') : t('lock.confirmNew')
})

function flashError(next: () => void) {
  error.value = true
  setTimeout(() => {
    error.value = false
    next()
    pad.value?.reset()
  }, 400)
}

async function onComplete(pin: string) {
  if (step.value === 'current') {
    if (await lock.matchesPin(pin)) {
      step.value = 'enter'
      pad.value?.reset()
    }
    else {
      flashError(() => {
        step.value = 'current'
      })
    }
    return
  }

  if (step.value === 'enter') {
    first.value = pin
    step.value = 'confirm'
    pad.value?.reset()
    return
  }

  // step === 'confirm'
  if (pin === first.value) {
    await lock.setPin(pin)
    ui.showToast(t('lock.pinSet'), 'success')
    emit('update:modelValue', false)
    return
  }
  // Eşleşmedi → yeni PIN adımına dön
  flashError(() => {
    step.value = 'enter'
    first.value = ''
  })
}
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="380" @update:model-value="emit('update:modelValue', $event)">
    <v-card class="pa-4">
      <PinPad
        ref="pad"
        :title="title"
        :length="activeLength"
        :error="error"
        @complete="onComplete"
      />
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">
          {{ t('common.cancel') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
