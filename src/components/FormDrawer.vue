<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'

// Oluştur/güncelle formları için ortak yan panel (navigation-drawer).
// Material Design: çerçeve/çizgi yok; ayrım yüzey rengi + elevation (gölge) ile.
const props = withDefaults(defineProps<{
  title: string
  /** Başlıkta ne düzenlendiğini söyleyen ikinci satır (ör. "Banka hesabı"). */
  subtitle?: string
  /** Başlık şeridindeki ikon rozeti. */
  icon?: string
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
    <!-- HEADER: primary şerit. Sayfa başlığı bandıyla aynı dil — panelin nereye
         ait olduğunu renk söylüyor, çizgi değil. -->
    <template #prepend>
      <div class="form-drawer-header pa-4 d-flex align-center ga-3">
        <v-avatar v-if="icon" color="on-primary" size="38" class="flex-0-0">
          <v-icon :icon="icon" color="primary" size="20" />
        </v-avatar>
        <div class="overflow-hidden flex-1-1">
          <div class="text-title-medium font-weight-bold text-truncate">{{ title }}</div>
          <div v-if="subtitle" class="text-body-small form-drawer-subtitle text-truncate">{{ subtitle }}</div>
        </div>
        <v-btn
          icon="mdi-close"
          variant="text"
          density="comfortable"
          class="flex-0-0"
          :aria-label="t('common.close')"
          @click="model = false"
        />
      </div>
    </template>

    <!-- Gövde: alanlar arası boşluğu KAP verir, tek yerden.
         Eskiden her form kendi `mb-2`sini (8px) koyuyordu; hem üç formda ayrı
         ayrı ayarlanıyordu hem de 8px Material için fazla sıkışıktı — anahtarlar
         zaten hiç boşluk almıyordu (hide-details). Artık form yalnız alanları
         sıralıyor, ritim burada. -->
    <div class="form-drawer-body">
      <slot />
    </div>

    <!-- FOOTER: çizgi yerine yukarı doğru gölge (elevation) -->
    <template #append>
      <div class="form-drawer-footer d-flex align-center ga-2 pa-4">
        <v-btn
          v-if="deletable"
          color="error"
          variant="text"
          prepend-icon="mdi-trash-can-outline"
          @click="emit('delete')"
        >
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

/* Başlık şeridi. Renk sınıf yerine değişkenden: bg-primary sınıfı Vuetify'ın
   runtime'da ürettiği bir kural ve tema değişince yeniden üretiliyor; burada
   değişkene bağlamak hem temayla hem "Ana renk" ayarıyla birlikte kayar.
   on-primary şart: primary zeminde varsayılan metin rengi okunmaz. */
.form-drawer-header {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}
.form-drawer-subtitle {
  opacity: 0.8;
}

/* Alanlar arası tek ritim. 20px: Material'de form alanları arası ~16-24px;
   8px (eski mb-2) etiketli outlined alanlarda kutuları birbirine yapıştırıyordu. */
.form-drawer-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
}

/* Footer'ı içerikten AYIRAN çizgi.
   Önce yalnız `box-shadow: 0 -2px 10px rgba(0,0,0,0.08)` vardı ve KOYU TEMADA
   HİÇ GÖRÜNMÜYORDU: gölge siyah, koyu yüzeye siyah bindirince fark 255'te 3
   birim kalıyor (ölçüldü — kontrast oranı 1.035; açık temada 1.192 ile iş
   görüyordu). Yani ayrım yalnız açık temada vardı.
   Çizgi temaya BAĞLI (on-surface): açık temada koyu, koyu temada açık çıkar —
   ölçülen kontrast 1.320 / 1.460, ikisinde de görünür.
   Gölge kaldırıldı: çizgi varken ikisi birden gürültü, üstelik gölgenin işe
   yaradığı tek tema zaten çizginin de çalıştığı tema. */
.form-drawer-footer {
  background: rgb(var(--v-theme-surface));
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  position: relative;
  z-index: 1;
}
</style>
