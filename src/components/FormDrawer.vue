<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'

// Oluştur/güncelle formları için ortak yan panel (navigation-drawer).
// Mobilde tam genişlik (fullscreen benzeri), masaüstünde yandan panel.
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
    <template #prepend>
      <v-toolbar density="comfortable" color="surface">
        <v-toolbar-title class="text-subtitle-1 font-weight-bold">{{ title }}</v-toolbar-title>
        <template #append>
          <v-btn icon="mdi-close" variant="text" @click="model = false" />
        </template>
      </v-toolbar>
      <v-divider />
    </template>

    <div class="pa-4">
      <slot />
    </div>

    <template #append>
      <v-divider />
      <div class="d-flex align-center ga-2 pa-3">
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
