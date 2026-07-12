import type { ThemeDefinition } from 'vuetify'

// Enterprise tema: tam semantik token seti (light + dark). Ana renk / nötr yüzeyler
// çalışma zamanında App.vue'de kullanıcı tercihine göre override edilir (theme feature).

const light: ThemeDefinition = {
  dark: false,
  colors: {
    'background': '#f6f7f9',
    'surface': '#ffffff',
    'surface-bright': '#ffffff',
    'surface-light': '#eceef2',
    'surface-variant': '#eceef2',
    'on-surface-variant': '#42474e',
    'primary': '#635bff',
    'secondary': '#5b6270',
    'error': '#e5484d',
    'info': '#0091ff',
    'success': '#30a46c',
    'warning': '#f5a623',
  },
  variables: {
    'border-color': '#000000',
    'border-opacity': 0.1,
    'high-emphasis-opacity': 0.87,
    'medium-emphasis-opacity': 0.62,
    'disabled-opacity': 0.38,
    'theme-kbd': '#212529',
    'theme-on-kbd': '#ffffff',
  },
}

const dark: ThemeDefinition = {
  dark: true,
  colors: {
    'background': '#0f1115',
    'surface': '#171a21',
    'surface-bright': '#2a2f3a',
    'surface-light': '#232833',
    'surface-variant': '#232833',
    'on-surface-variant': '#c4c9d2',
    'primary': '#7c74ff',
    'secondary': '#9aa2b1',
    'error': '#ff6369',
    'info': '#52a9ff',
    'success': '#4cc38a',
    'warning': '#ffca62',
  },
  variables: {
    'border-color': '#ffffff',
    'border-opacity': 0.12,
    'high-emphasis-opacity': 0.92,
    'medium-emphasis-opacity': 0.68,
    'disabled-opacity': 0.4,
    'theme-kbd': '#e9ecef',
    'theme-on-kbd': '#000000',
  },
}

export const themeConfig = {
  defaultTheme: 'dark',
  // Renk varyasyonları (primary-lighten-1, error-darken-2 vb.) enterprise bileşenlerde kullanılabilir.
  variations: {
    colors: ['primary', 'secondary', 'success', 'error', 'warning', 'info'],
    lighten: 3,
    darken: 3,
  },
  themes: { light, dark },
}
