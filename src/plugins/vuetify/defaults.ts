// Global yapılandırma (global-configuration): tüm uygulamada tutarlı bileşen varsayılanları.
// Tek yerden değiştirilir; her bileşende tekrar prop yazmaya gerek kalmaz.

/**
 * Ayarlanabilir köşe yuvarlaklığı (Ayarlar → Görünüm). App.vue --app-radius'u günceller.
 *
 * Neden CSS değişkeni: `rounded` prop'u değeri inline style'a yazar, yani sabit bir
 * sayı verirsek ayar değişince defaults'ı runtime'da güncellemek gerekirdi. CSS
 * değişkeni zaten reaktif — tek kaynak, izleyici yok.
 *
 * DİKKAT — `tile` prop'u artık İŞE YARAMAZ: yalnız .rounded-0 class'ı ekler,
 * buradaki rounded ise inline style üretip onu ezer. Kare isteniyorsa rounded="0"
 * kullanılmalı (prop default'u tamamen değiştirir, style üretilmez).
 *
 * Neden fallback (12px) ZORUNLU: useRounded değeri stile çevirmeden önce
 * `/[0-9]/` testinden geçiriyor. Rakamsız 'var(--app-radius)' bu testi geçemez ve
 * style hiç üretilmez (ölçüldü). Fallback'teki 12 aynı zamanda bu testi geçirir —
 * yani süs değil, işlevsel. Silme.
 */
const RADIUS = 'var(--app-radius, 12px)'

/**
 * İç içe geçmiş yüzeyler için: dış yarıçap eksi aradaki boşluk (eşmerkezli köşe).
 * max(0px, ...) şart — radius 0'da negatif border-radius geçersizdir ve kural düşer.
 */
const RADIUS_INNER = 'max(0px, calc(var(--app-radius, 12px) - 4px))'

export const defaults = {
  global: {
    // Erişilebilirlik + performans: hareket azaltma tercihi olanlarda ripple kapatılabilir
    ripple: true
  },

  // İkon butonları dahil TÜM butonlar ayarı izler. `rounded` inline style üretip
  // Vuetify'ın `.v-btn--icon { border-radius: 50% }` kuralını ezer — bu istenen
  // davranış: "ikon buton = daire" Vuetify'ın varsayımı, bizim tasarımımız değil.
  // Daire gereken yerde rounded="circle" ile açıkça çıkılır.
  VBtn: {
    rounded: RADIUS,
    variant: 'flat',
    style: 'text-transform: none;' // enterprise: BÜYÜK HARF yerine normal metin
  },

  // --- Yuvarlaklık ayardan gelen yüzeyler --------------------------------
  // VAvatar dahil: bu uygulamada fotoğraf avatarı YOK, hepsi renkli ikon rozeti
  // (kategori/etiket/cüzdan). Daire kalması gereken tek istisna marka işareti;
  // o, rounded="circle" ile açıkça dışarı çıkar (prop defaults'ı tamamen ezer,
  // inline style üretilmez — ölçüldü).
  VAvatar: { rounded: RADIUS },
  VCard: { rounded: RADIUS },
  VSheet: { rounded: RADIUS },
  VChip: { rounded: RADIUS },
  VAlert: { rounded: RADIUS },
  VListItem: { rounded: RADIUS },

  // Segmented control: track dıştan, segmentler 4px iç boşluk kadar daha az yuvarlak.
  VBtnGroup: { rounded: RADIUS },
  VBtnToggle: { VBtn: { rounded: RADIUS_INNER } },

  // Tüm form alanları burada yönetilir (global-configuration) — bileşen bileşen
  // variant yazılmaz. Yuvarlaklık VField üzerinden: outlined çerçeve parçaları
  // (__outline/__start/__end) radius'u .v-field'dan 'inherit' eder.
  VField: { rounded: RADIUS },
  VTextField: {
    variant: 'outlined',
    density: 'comfortable',
    hideDetails: 'auto'
  },
  VTextarea: {
    variant: 'outlined',
    density: 'comfortable',
    hideDetails: 'auto'
  },
  VSelect: {
    variant: 'outlined',
    density: 'comfortable',
    hideDetails: 'auto'
  },
  VAutocomplete: {
    variant: 'outlined',
    density: 'comfortable',
    hideDetails: 'auto'
  },
  VCombobox: {
    variant: 'outlined',
    density: 'comfortable',
    hideDetails: 'auto'
  },
  // VDateInput'a variant/density AYRICA yazılmak ZORUNDA — yukarıdaki
  // VTextField varsayılanı buraya İNMEZ. Sebep: VDateInput, VTextField'ın
  // proplarını `makeVTextFieldProps()` ile KENDİ propu olarak tanımlıyor ve
  // içteki VTextField'a `VTextField.filterProps(props)` ile AÇIKÇA geçiriyor.
  // Açıkça geçirilen prop, o bileşenin default'unu ezer; yani alan VField'ın
  // `default: 'filled'` değeriyle dolgulu çıkıyordu — tek bu alan diğerlerinden
  // farklı görünmesinin sebebi buydu (ölçüldü: VDateInput.js:44, :206).
  // prependIcon: aynı mekanizmayla '$calendar' default'u takvim ikonunu alanın
  // DIŞINA koyuyor. Boş string dış ikonu tamamen kaldırır (Vuetify
  // `slots.prepend || props.prependIcon` ile bakıyor; '' falsy → prepend hiç
  // render edilmez), ikon prependInnerIcon ile içeri alınır.
  VDateInput: {
    variant: 'outlined',
    density: 'comfortable',
    hideDetails: 'auto',
    prependIcon: '',
    prependInnerIcon: '$calendar'
  },

  VList: {
    density: 'comfortable',
    rounded: RADIUS
  },
  VDialog: {
    scrollable: true
  },
  // Takvim: seçili gün / bugün göstergesi ana renkte.
  // VDateInput'a color VERMEK İŞE YARAMAZ: kendi color'ını picker'a geçirmiyor
  // (kaynak: VDatePicker.filterProps(omit(props, [... 'color' ...]))) — yalnız
  // metin alanına uygular. Bileşen default'u ise VDatePicker'a doğrudan iner.
  VDatePicker: {
    color: 'primary'
  },
  VSnackbar: {
    location: 'bottom',
    rounded: RADIUS
  },
  // inset: 'material' → MD3 anahtar biçimi (dolu thumb, kapsül track).
  // Vuetify: isMaterial = ['material','square'].includes(inset) → .v-switch--inset-material
  VSwitch: {
    color: 'primary',
    density: 'comfortable',
    hideDetails: true,
    inset: 'material'
  },
  VSlider: {
    color: 'primary',
    hideDetails: true
  },
  VProgressLinear: {
    rounded: true
  },
  VTooltip: {
    location: 'top'
  }
}
