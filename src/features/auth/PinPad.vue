<script setup lang="ts">
defineProps<{ title?: string, subtitle?: string, error?: boolean }>()
const emit = defineEmits<{ complete: [string] }>()

const LENGTH = 4
const buffer = ref('')

function push(d: string) {
  if (buffer.value.length >= LENGTH)
    return
  buffer.value += d
  if (buffer.value.length === LENGTH)
    emit('complete', buffer.value)
}

function back() {
  buffer.value = buffer.value.slice(0, -1)
}

function reset() {
  buffer.value = ''
}

defineExpose({ reset })

const dots = computed(() => Array.from({ length: LENGTH }, (_, i) => i < buffer.value.length))
const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
</script>

<template>
  <div class="pinpad text-center">
    <div v-if="title" class="text-title-large font-weight-medium mb-1">{{ title }}</div>
    <div v-if="subtitle" class="text-body-medium text-medium-emphasis mb-4">{{ subtitle }}</div>

    <div class="dots mb-6" :class="{ shake: error }">
      <span v-for="(filled, i) in dots" :key="i" class="dot" :class="{ filled }" />
    </div>

    <div class="keys">
      <v-btn v-for="k in keys" :key="k" variant="tonal" size="large" class="key" @click="push(k)">
        <span class="text-title-large">{{ k }}</span>
      </v-btn>
      <div />
      <v-btn variant="tonal" size="large" class="key" @click="push('0')">
        <span class="text-title-large">0</span>
      </v-btn>
      <v-btn variant="text" size="large" class="key" icon="mdi-backspace-outline" @click="back" />
    </div>
  </div>
</template>

<style scoped>
.pinpad { max-width: 280px; margin: 0 auto; }
.dots { display: flex; justify-content: center; gap: 16px; }
.dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(127,127,127,0.5); transition: background 0.15s; }
.dot.filled { background: rgb(var(--v-theme-primary)); border-color: rgb(var(--v-theme-primary)); }
.keys { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.key { min-height: 60px; }
.shake { animation: shake 0.35s; }
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-8px); }
  40%, 80% { transform: translateX(8px); }
}
</style>
