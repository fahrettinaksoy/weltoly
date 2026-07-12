import { VBtn, VCard } from 'vuetify/components'

// Aliasing: aynı bileşenin farklı varsayılanlarla semantik türevleri.
// Kullanım: <v-btn-primary>, <v-btn-danger>, <v-btn-ghost>, <v-card-section>.
export const aliases = {
  VBtnPrimary: VBtn,
  VBtnDanger: VBtn,
  VBtnGhost: VBtn,
  VCardSection: VCard,
}

// Alias'lara özel varsayılanlar (index.ts'te global defaults ile birleşir).
export const aliasDefaults = {
  VBtnPrimary: { color: 'primary', variant: 'flat', rounded: 'lg' },
  VBtnDanger: { color: 'error', variant: 'flat', rounded: 'lg' },
  VBtnGhost: { variant: 'text', rounded: 'lg' },
  VCardSection: { variant: 'tonal', rounded: 'lg' },
}

// TS: alias'lı bileşenleri şablonlarda tanı (vue-tsc + IDE için).
declare module 'vue' {
  interface GlobalComponents {
    VBtnPrimary: typeof VBtn
    VBtnDanger: typeof VBtn
    VBtnGhost: typeof VBtn
    VCardSection: typeof VCard
  }
}
