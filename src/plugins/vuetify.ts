import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'

import { createVuetify, type ThemeDefinition } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi'

// Weltoly tema paleti. Ana renk (primary) ayarlardan değiştirilebilecek (Faz 4);
// şimdilik varsayılan bir indigo/menekşe aksan.
const light: ThemeDefinition = {
  dark: false,
  colors: {
    'background': '#f6f7f9',
    'surface': '#ffffff',
    'surface-variant': '#eceef2',
    'primary': '#635bff',
    'secondary': '#5b6270',
    'error': '#e5484d',
    'info': '#0091ff',
    'success': '#30a46c',
    'warning': '#f5a623',
  },
}

const dark: ThemeDefinition = {
  dark: true,
  colors: {
    'background': '#0f1115',
    'surface': '#171a21',
    'surface-variant': '#232833',
    'primary': '#7c74ff',
    'secondary': '#9aa2b1',
    'error': '#ff6369',
    'info': '#52a9ff',
    'success': '#4cc38a',
    'warning': '#ffca62',
  },
}

export const vuetify = createVuetify({
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: { mdi },
  },
  theme: {
    defaultTheme: 'dark',
    themes: { light, dark },
  },
  defaults: {
    VCard: { rounded: 'lg' },
    VBtn: { rounded: 'lg' },
    VTextField: { variant: 'outlined', density: 'comfortable' },
    VSelect: { variant: 'outlined', density: 'comfortable' },
  },
})
