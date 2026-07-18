<script setup lang="ts">
// Material renk seçici: çerçeve/outline yok; seçili renk üzerinde check ikonu.
defineProps<{ modelValue: string; colors: string[] }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()
</script>

<template>
  <div class="d-flex flex-wrap ga-2">
    <button
      v-for="c in colors"
      :key="c"
      type="button"
      class="swatch"
      :style="{ background: c }"
      :aria-label="c"
      :aria-pressed="modelValue === c"
      @click="emit('update:modelValue', c)"
    >
      <v-icon
        v-if="modelValue === c"
        icon="mdi-check"
        size="18"
        color="white"
        class="swatch-check"
      />
    </button>
  </div>
</template>

<style scoped>
/* Vuetify bileşeni değil (düz <button>) → defaults ulaşmaz, yuvarlaklık
   doğrudan --app-radius'tan alınır. */
.swatch {
  width: 32px;
  height: 32px;
  border-radius: var(--app-radius);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.12s ease;
}
.swatch:hover {
  transform: scale(1.12);
}
.swatch-check {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
}
</style>
