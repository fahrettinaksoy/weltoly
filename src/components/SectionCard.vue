<script setup lang="ts">
/**
 * Tasarımlı başlığı olan bölüm kartı: ikon rozeti + başlık + opsiyonel açıklama.
 * Ayrım çizgiyle değil, yüzey tonuyla (Material: surface container).
 *
 * Ayarlar sayfası için yazılmıştı (SettingsGroup) ama tasarımın ayarlarla ilgisi
 * yok — cüzdan detayındaki paneller de aynı başlığı kullanıyor, o yüzden adı
 * genelleştirildi. Kart yüzeyi/başlık tonu tek yerde; sayfalar tekrar etmez.
 */
defineProps<{
  title: string
  subtitle?: string
  icon?: string
}>()
</script>

<template>
  <v-card color="surface-light" variant="flat" :elevation="0">
    <div class="section-header d-flex align-center ga-3 px-4 py-3">
      <v-avatar v-if="icon" color="primary" size="34">
        <v-icon :icon="icon" size="19" color="white" />
      </v-avatar>
      <div class="overflow-hidden">
        <div class="text-subtitle-2 font-weight-bold text-truncate">
          {{ title }}
        </div>
        <div v-if="subtitle" class="text-caption text-medium-emphasis text-truncate">
          {{ subtitle }}
        </div>
      </div>
      <v-spacer />
      <slot name="actions" />
    </div>

    <v-card-text>
      <slot />
    </v-card-text>
  </v-card>
</template>

<style scoped>
/* Başlık şeridi: çizgi yok — gövdeden DAHA KOYU bir tonla ayrışır.
   Siyah tint kullanılır ki hem açık hem koyu temada koyulaştırsın
   (beyaz tint koyu temada tersine açardı). */
.section-header {
  background: rgba(0, 0, 0, 0.06);
}
</style>
