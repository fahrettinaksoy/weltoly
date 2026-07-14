<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'

// Oluştur/güncelle formları için ortak yan panel (navigation-drawer).
// Material Design: çerçeve/çizgi yok; ayrım yüzey rengi + elevation (gölge) ile.
const props = withDefaults(defineProps<{
  title: string
  deletable?: boolean
  saveDisabled?: boolean
  width?: number
}>(), { deletable: false, saveDisabled: false, width: 420 })

const emit = defineEmits<{ save: [], delete: [] }>()
const model = defineModel<boolean>({ required: true })

const { t } = useI18n()
const { mobile, width: viewportWidth } = useDisplay()

// Mobilde ekranı kapla; masaüstünde sabit panel genişliği.
const drawerWidth = computed(() => (mobile.value ? viewportWidth.value : props.width))
</script>

<template>
  <v-navigation-drawer
    v-model="model"
    location="right"
    temporary
    :width="drawerWidth"
    class="form-drawer"
  >
    <!-- HEADER: çizgisiz üst bar (Material: elevation, kaydırınca gölge) -->
    <template #prepend>
      <v-toolbar density="comfortable" color="surface" class="form-drawer-header">
        <v-toolbar-title class="text-subtitle-1 font-weight-bold">{{ title }}</v-toolbar-title>
        <template #append>
          <v-btn icon="mdi-close" variant="text" :aria-label="t('common.close')" @click="model = false" />
        </template>
      </v-toolbar>
    </template>

    <div class="pa-4">
      <slot />
    </div>

    <!-- FOOTER: çizgi yerine yukarı doğru gölge (elevation) -->
    <template #append>
      <div class="form-drawer-footer d-flex align-center ga-2 pa-3">
        <v-btn v-if="deletable" color="error" variant="text" @click="emit('delete')">
          {{ t('common.delete') }}
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="model = false">{{ t('common.cancel') }}</v-btn>
        <v-btn color="primary" variant="flat" :disabled="saveDisabled" @click="emit('save')">
          {{ t('common.save') }}
        </v-btn>
      </div>
    </template>
  </v-navigation-drawer>
</template>

<style scoped>
/* Form drawer'ı HEADER'ın (app-bar) ÜZERİNE açılsın: tam yükseklik + app-bar üstünde z-index. */
.form-drawer.v-navigation-drawer--temporary {
  top: 0 !important;
  height: 100% !important;
  z-index: 2000 !important;
}

/* Material: kenar çizgisi yok; drawer'ın kendi elevation gölgesi ayrımı sağlar. */
.form-drawer.v-navigation-drawer {
  border: none !important;
}

/* Material: çerçeve yok. Footer içeriğin üzerinde "yüzen" bir yüzey → yukarı gölge. */
.form-drawer-footer {
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.08);
  position: relative;
  z-index: 1;
}
</style>
