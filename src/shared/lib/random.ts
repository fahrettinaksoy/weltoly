/** Bir diziden rastgele bir eleman döndürür (cüzdan/kategori varsayılan renk/ikonu için). */
export function random<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}
