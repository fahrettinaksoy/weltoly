/**
 * Dönem karşılaştırma (delta rozetleri) — TEK KAYNAK (Y-5).
 *
 * Bu iki fonksiyon StatPage, DashboardPage ve WalletDetailPage içinde BİREBİR
 * KOPYA olarak yaşıyordu; `periodCompare.test.ts` ise dördüncü bir kopyayı test
 * ediyordu. Kopyalar ayrışınca (bir yerde `<` diğerinde `<=`) test yeşil kalır,
 * rozet sessizce yanlış yön/renk gösterirdi — ne build ne typecheck fark eder.
 * Artık üç sayfa da, test de buradan import eder.
 */

/**
 * Değişim oranı (%). null = KIYASLANAMAZ, rozet gösterilmez.
 *
 * Önceki dönem 0 ise yüzde TANIMSIZDIR (0'a bölme): "%Infinity arttı" yazmak
 * yerine rozet hiç çizilmez — sıfırdan artış oransal bir artış değildir.
 * Payda `Math.abs`: önceki değer negatifse (borç) işaret ters dönmesin.
 */
export function changeRatio(current: number, previous: number): number | null {
  if (previous === 0)
    return null
  return ((current - previous) / Math.abs(previous)) * 100
}

/**
 * Rozet rengi. undefined = nötr (renksiz).
 *
 * Yön TEK BAŞINA renk belirlemez: gider ARTIŞI kötü, gelir artışı iyi — ikisini
 * de yeşil yapmak kullanıcıyı yanıltırdı. Bu yüzden çağıran `positiveIsGood` ile
 * anlamı bildirir.
 * %1'in altındaki sapmalar nötr: olmayan bir eğilimi varmış gibi boyamamak için.
 */
export function deltaTone(delta: number, positiveIsGood: boolean): string | undefined {
  if (Math.abs(delta) < 1)
    return undefined
  return (delta > 0) === positiveIsGood ? 'success' : 'error'
}
