<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/**
 * Merkezî onay dialogu — geri alınamaz işlemler (silme vb.) için tek bileşen.
 * Her sayfada ayrı v-dialog kopyalamak yerine burada tutulur; metin ve
 * onay rengi dışarıdan verilir.
 */
withDefaults(defineProps<{
  /** Onay butonunun metni. Varsayılan: "Sil". */
  confirmText?: string
  /** Onay butonunun rengi. Varsayılan: error (yıkıcı işlem). */
  confirmColor?: string
  /** Ne olacağını anlatan metin. */
  message: string
  title?: string
}>(), {
  confirmColor: 'error',
})

const model = defineModel<boolean>({ required: true })
const emit = defineEmits<{ confirm: [] }>()

const { t } = useI18n()

/**
 * SIRA ÖNEMLİ: önce 'confirm', sonra kapatma.
 * Ters sırada, v-model'i türetilmiş bir duruma bağlayan çağıranlar
 * (ör. :model-value="!!pendingDelete") kapanış olayında o durumu temizler ve
 * 'confirm' handler'ı elinde veri olmadan çalışır — işlem sessizce hiç yapılmaz.
 */
function onConfirm() {
  emit('confirm')
  model.value = false
}
</script>

<template>
  <v-dialog v-model="model" max-width="400">
    <v-card>
      <v-card-title v-if="title" class="text-h6">{{ title }}</v-card-title>
      <v-card-text class="text-body-2">{{ message }}</v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="model = false">{{ t('common.cancel') }}</v-btn>
        <v-btn :color="confirmColor" variant="flat" @click="onConfirm">
          {{ confirmText ?? t('common.delete') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
