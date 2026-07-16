<script setup lang="ts">
/**
 * Uygulama geneli BOŞ DURUM bileşeni (Material Design empty-state).
 *
 * Vuetify'ın VEmptyState'i üzerine ince sarmalayıcı: tek fark, ikonu MD3 tarzı
 * tonal DAİRE içine alması (çıplak ikon yerine). Böylece "veri yok / bulunamadı /
 * süzgece uyan yok" durumlarının HEPSİ aynı görünür — liste boşu, arama boşu ve
 * hata boşu farklı sayfalarda farklı çizilmesin diye tek kaynak.
 *
 * İki eylem yolu:
 *  - `actionText` (+ `actionIcon`) veril: standart tonal buton, tıklayınca `action`
 *    olayı yayınlanır (çağıran ne yapacağına karar verir: rota, diyalog, sıfırla).
 *  - `#action` slot'u: tamamen özel düğme(ler) gerektiğinde.
 */
withDefaults(defineProps<{
  icon: string
  title: string
  /** İkincil açıklama; kısa bir cümle. */
  text?: string
  /** Eylem düğmesi etiketi. Verilmezse (ve #action slot'u yoksa) düğme çizilmez. */
  actionText?: string
  actionIcon?: string
  /** Vurgu (ikon dairesi) rengi. */
  color?: string
  /** Kart içi küçük boşluklar için 'compact'; sayfa/tablo boşları için 'default'. */
  density?: 'compact' | 'default'
}>(), {
  color: 'primary',
  density: 'default',
})

defineEmits<{ action: [] }>()
</script>

<template>
  <v-empty-state
    :title="title"
    :text="text"
    :class="density === 'compact' && 'app-empty-state--compact'"
  >
    <!-- Media: çıplak ikon yerine tonal daire (MD3). VEmptyState media slot'u
         gelince kendi VIcon default'unu geçirmez → boyut/renk burada nettir. -->
    <template #media>
      <v-avatar
        :color="color"
        variant="tonal"
        rounded="circle"
        :size="density === 'compact' ? 64 : 96"
      >
        <v-icon :icon="icon" :size="density === 'compact' ? 30 : 44" :color="color" />
      </v-avatar>
    </template>

    <template v-if="actionText || $slots.action" #actions>
      <slot name="action">
        <v-btn
          :prepend-icon="actionIcon"
          color="primary"
          variant="tonal"
          @click="$emit('action')"
        >
          {{ actionText }}
        </v-btn>
      </slot>
    </template>
  </v-empty-state>
</template>

<style scoped>
/* Kart içi (grafik/panel) boşları sayfa boşları kadar uzun olmasın. */
.app-empty-state--compact {
  padding-block: 8px;
}
.app-empty-state--compact :deep(.v-empty-state__media) {
  margin-bottom: 8px;
}
</style>
