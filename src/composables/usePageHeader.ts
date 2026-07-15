import { onScopeDispose, shallowRef } from 'vue'

/**
 * Hero bandının başlığını sayfanın devralması için.
 *
 * Bant normalde rotanın navKey'inden statik etiket üretir ("Cüzdanlar"). Detay
 * sayfalarında bu yanlış: orada varlığın kendi adı yazmalı ("Garanti Bonus").
 * useAppBarAction ile aynı desen: sayfa kurar, scope kapanınca temizlenir —
 * listeye dönünce bant kendiliğinden varsayılana düşer.
 */
export type PageHeaderDef = {
  title: string
  desc?: string
  icon?: string
  /** Geri dönülecek rota; verilirse bantta geri butonu görünür. */
  backTo?: string
  /** İçerik kartının şerit başlığı. Verilmezse "Liste" (liste sayfaları için). */
  cardTitle?: string
  /**
   * Şeritte başlık yerine sekme. Verilirse cardTitle yok sayılır.
   * model + onChange ile: sekme durumu SAYFANIN, burası yalnız gösterir.
   * usePageHeader getter aldığı için model her değişimde tazelenir.
   */
  tabs?: {
    items: { value: string, label: string, icon?: string }[]
    model: string
    onChange: (value: string) => void
  }
}

const current = shallowRef<PageHeaderDef | null>(null)

/**
 * Bu sayfa için bant başlığını devral; sayfa (scope) kapanınca bırakılır.
 *
 * DİKKAT: watchEffect ANINDA çalışır — getter setup sırasında bir kez hemen
 * değerlendirilir. Okuduğu her ref/computed bu çağrıdan ÖNCE tanımlı olmalı,
 * yoksa "Cannot access before initialization" ile sayfa açılışta çöker.
 * TypeScript bunu callback içinden göremez; build de geçer.
 */
export function usePageHeader(header: () => PageHeaderDef) {
  // Kaynak reaktif olabilir (cüzdan adı store'dan geç gelir) → watchEffect ile izle.
  watchEffect(() => {
    current.value = header()
  })
  onScopeDispose(() => {
    current.value = null
  })
}

/** DefaultLayout okur. */
export function pageHeader() {
  return current
}
