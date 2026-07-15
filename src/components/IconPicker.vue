<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { categoryIcons } from '@/features/categories/iconList'

/**
 * Paylaşılan ikon seçici dialogu (kategori + cüzdan formları).
 * Tek bileşen: kopyalansaydı arama/ızgara davranışı zamanla ayrışırdı.
 *
 * İki model: `modelValue` dialogun açıklığı, `icon` seçilen ikon.
 */
const model = defineModel<boolean>({ required: true })
const icon = defineModel<string>('icon', { required: true })

defineProps<{ title: string }>()

const { t } = useI18n()
const search = ref('')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q ? categoryIcons.filter(i => i.toLowerCase().includes(q)) : categoryIcons
})

function pick(value: string) {
  icon.value = value
  model.value = false
}
</script>

<template>
  <v-dialog v-model="model" max-width="520" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center">
        {{ title }}
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" size="small" :aria-label="t('$vuetify.dismiss')" @click="model = false" />
      </v-card-title>

      <v-card-text style="max-height: 60vh;">
        <v-text-field
          v-model="search"
          prepend-inner-icon="mdi-magnify"
          density="compact"
          hide-details
          clearable
          class="mb-3"
        />
        <div class="icon-grid">
          <v-btn
            v-for="ic in filtered"
            :key="ic"
            :icon="ic"
            variant="text"
            size="small"
            :color="icon === ic ? 'primary' : undefined"
            :aria-label="ic"
            :aria-pressed="icon === ic"
            @click="pick(ic)"
          />
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
  gap: 4px;
}
</style>
