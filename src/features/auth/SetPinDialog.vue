<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { useLockStore } from '@/features/auth/useLockStore'
import { useUiStore } from '@/stores/ui'
import PinPad from '@/features/auth/PinPad.vue'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const { t } = useI18n()
const lock = useLockStore()
const ui = useUiStore()

const pad = ref<InstanceType<typeof PinPad>>()
const step = ref<'enter' | 'confirm'>('enter')
const first = ref('')
const error = ref(false)

watch(() => props.modelValue, (open) => {
  if (open) {
    step.value = 'enter'
    first.value = ''
    error.value = false
    pad.value?.reset()
  }
})

async function onComplete(pin: string) {
  if (step.value === 'enter') {
    first.value = pin
    step.value = 'confirm'
    pad.value?.reset()
    return
  }
  if (pin === first.value) {
    await lock.setPin(pin)
    ui.showToast(t('lock.pinSet'), 'success')
    emit('update:modelValue', false)
    return
  }
  // Eşleşmedi → baştan
  error.value = true
  setTimeout(() => {
    error.value = false
    step.value = 'enter'
    first.value = ''
    pad.value?.reset()
  }, 400)
}
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="380" @update:model-value="emit('update:modelValue', $event)">
    <v-card class="pa-4">
      <PinPad
        ref="pad"
        :title="step === 'enter' ? t('lock.enterNew') : t('lock.confirmNew')"
        :error="error"
        @complete="onComplete"
      />
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">{{ t('common.cancel') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
