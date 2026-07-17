/**
 * Tıklanabilir tablo satırlarını KLAVYEYE açar (A-4).
 *
 * SORUN: `@click:row` yalnız fare olayıdır. `<tr>` varsayılan olarak
 * odaklanabilir değildir, `keydown` görmez. Bu yüzden işlem tablolarında klavye
 * kullanıcısı HİÇBİR işlemi düzenleyemiyordu — o tablolarda satır tıklaması tek
 * düzenleme yolu (Cüzdanlar/Kategoriler/Etiketler'in aksine, orada satır içi
 * kalem butonu var ve o zaten erişilebilir).
 *
 * `cursor: pointer` ile "tıklanabilir" denen bir şeyin klavyeye kapalı olması
 * kozmetik değil, işlevsel engeldir.
 *
 * NEDEN `role="button"` YOK: `<tr>`'nin örtük `role="row"`'unu ezmek onu tablo
 * yapısından koparır — ekran okuyucu satır/sütun bağlamını, "3 / 181" konumunu
 * ve başlık ilişkisini kaybeder. Satır satır KALIR, yalnız odaklanabilir olur;
 * içeriği zaten hücrelerden okunur. Aynı sebeple `aria-label` de verilmez:
 * satırın üzerine yazıp asıl içeriği susturur.
 *
 * SINIR: her satır bir tab durağıdır (181 işlem = 181 durak). Tam çözüm ARIA
 * grid deseni + roving tabindex'tir, ama tablolar sanallaştırılmış
 * (v-data-table-virtual) olduğu için o desen ayrı bir iş. "Çok tab" durumu
 * "hiç erişilemiyor"dan iyidir; mevcut üç tablo zaten satır başına 2 buton
 * (kalem/çöp) ile aynı maliyeti taşıyor.
 */
export interface RowA11yData<T> { item: T }

export function keyboardRowProps<T>(activate: (item: T) => void) {
  return ({ item }: RowA11yData<T>) => ({
    tabindex: 0,
    onKeydown: (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ')
        return
      // Satırın İÇİNDEKİ bir öğe odaktaysa (ileride buton/çip eklenirse) onun
      // kendi davranışını çalma.
      if (e.target !== e.currentTarget)
        return
      // Space sayfayı kaydırır; Enter form gönderebilir.
      e.preventDefault()
      activate(item)
    },
  })
}
