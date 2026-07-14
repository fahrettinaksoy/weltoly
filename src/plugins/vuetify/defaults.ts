// Global yapılandırma (global-configuration): tüm uygulamada tutarlı bileşen varsayılanları.
// Tek yerden değiştirilir; her bileşende tekrar prop yazmaya gerek kalmaz.

export const defaults = {
  global: {
    // Erişilebilirlik + performans: hareket azaltma tercihi olanlarda ripple kapatılabilir
    ripple: true,
  },

  VBtn: {
    rounded: 'lg',
    variant: 'flat',
    style: 'text-transform: none;', // enterprise: BÜYÜK HARF yerine normal metin
  },
  VCard: {
    rounded: 'lg',
  },
  VTextField: {
    variant: 'filled',
    density: 'comfortable',
    hideDetails: 'auto',
  },
  VTextarea: {
    variant: 'filled',
    density: 'comfortable',
    hideDetails: 'auto',
  },
  VSelect: {
    variant: 'filled',
    density: 'comfortable',
    hideDetails: 'auto',
  },
  VAutocomplete: {
    variant: 'filled',
    density: 'comfortable',
    hideDetails: 'auto',
  },
  VCombobox: {
    variant: 'filled',
    density: 'comfortable',
    hideDetails: 'auto',
  },
  VChip: {
    rounded: 'lg',
  },
  VList: {
    density: 'comfortable',
  },
  VDialog: {
    scrollable: true,
  },
  VSnackbar: {
    location: 'bottom',
    rounded: 'lg',
  },
  VSwitch: {
    color: 'primary',
    density: 'comfortable',
    hideDetails: true,
    inset: true,
  },
  VSlider: {
    color: 'primary',
    hideDetails: true,
  },
  VProgressLinear: {
    rounded: true,
  },
  VTooltip: {
    location: 'top',
  },
}
