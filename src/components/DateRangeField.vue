<script setup lang="ts">
/**
 * Tarih ARALIĞI süzgeci — okunur alan + açılır takvim.
 *
 * Neden VDateInput değil: VDateInput `multiple="range"` modunda gösterim metnini
 * `${başlangıç} - ${bitiş}` olarak SABİT üretir (kaynak: VDateInput.js, display
 * computed). Tek gün seçilince başlangıç = bitiş olduğu için alanda
 * "09.07.2026 - 09.07.2026" gibi tarih İKİ KEZ yazıyordu; bunu ezecek prop ya da
 * slot yok. Burada gösterim metnini kendimiz kuruyoruz: tek gün → tek tarih,
 * aralık → "başlangıç - bitiş". Biçim uygulamanın kendi ayarından (useFormat).
 */
import { dateRangeText } from '@/shared/lib/dateRange'

const props = defineProps<{
  modelValue: Date[]
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Date[]]
}>()

const fmt = useFormat()

const displayText = computed(() => dateRangeText(props.modelValue, fmt.date))

/**
 * Menü AÇIKÇA kontrol edilir (O-12). Eskiden yalnız `activator="parent"` vardı:
 * VMenu aktivatöre TIKLAMA bağlar, oysa readonly bir metin alanında Enter/Space
 * tıklama üretmez — takvim yalnızca FAREYLE açılabiliyordu, klavye kullanıcısı
 * (ve ekran okuyucu) süzgece hiç ulaşamıyordu.
 * Aktivatör de duruyor, yani fare davranışı aynen korunuyor.
 */
const menuOpen = ref(false)

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault() // Space sayfayı kaydırmasın
    menuOpen.value = true
    return
  }
  if (e.key === 'Escape' && menuOpen.value) {
    e.preventDefault()
    menuOpen.value = false
  }
}

function onPick(value: unknown) {
  // VDatePicker range modunda Date[] döndürür; boş/null'ı da diziye normalize et.
  emit('update:modelValue', Array.isArray(value) ? (value as Date[]) : value ? [value as Date] : [])
}

function clear() {
  emit('update:modelValue', [])
}
</script>

<template>
  <!-- a11y: combobox rolü + aria-expanded, açılır takvimi ekran okuyucuya
       duyurur; keydown ile Enter/Space klavyeden açar (O-12). -->
  <v-text-field
    :model-value="displayText"
    :placeholder="placeholder"
    prepend-inner-icon="$calendar"
    density="compact"
    variant="outlined"
    hide-details
    readonly
    clearable
    role="combobox"
    aria-haspopup="dialog"
    :aria-expanded="menuOpen"
    @keydown="onKeydown"
    @click:clear="clear"
  >
    <v-menu v-model="menuOpen" activator="parent" :close-on-content-click="false" min-width="0">
      <v-date-picker
        :model-value="modelValue"
        multiple="range"
        show-adjacent-months
        @update:model-value="onPick"
      />
    </v-menu>
  </v-text-field>
</template>
