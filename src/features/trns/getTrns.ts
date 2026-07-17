import type { TrnId, TrnsGetterProps } from '@/features/trns/types'

import { TrnType } from '@/features/trns/types'

/**
 * İşlem id'lerini süzer.
 *
 * TARİH SÖZLEŞMESİ (O-2) — `dates` sınırları KAPALI aralıktır: `[start, end]`.
 * İkisi de işlemin ham `date` damgasıyla karşılaştırılır; fonksiyon sınırları
 * NORMALİZE ETMEZ. Yani `end` olarak bir günün 00:00'ını verirsen O GÜNÜN
 * neredeyse tüm işlemleri elenir (klasik off-by-one).
 *
 * Çağıran, gün bazlı süzme yapıyorsa sınırları kendisi normalize etmeli:
 *   start = startOfDay(ilkGün), end = endOfDay(sonGün)
 * `rangeForPeriod` (features/date/utils) zaten bunu yapar; sayfalardaki tarih
 * aralığı süzgeçleri de startOfDay/endOfDay uygular.
 *
 * Normalizasyon bilinçli olarak burada DEĞİL: gün-altı (saat bazlı) süzme
 * imkânını kapatmamak için. Bu davranış testle kilitlidir (getTrns.test.ts).
 *
 * GİRDİ MUTASYONU YOK (O-1): `props.trnsIds` asla yerinde sıralanmaz.
 */
export function filterTrnsIds(props: TrnsGetterProps) {
  if (!props.trnsIds && !props.trnsItems)
    return []

  const trnsIds: TrnId[] = props.trnsIds || Object.keys(props.trnsItems ?? {})

  const walletsSet = props.walletsIds?.length ? new Set(props.walletsIds) : null
  const categoriesSet = props.categoriesIds?.length ? new Set(props.categoriesIds) : null
  const tagsSet = props.tagsIds?.length ? new Set(props.tagsIds) : null
  const typesSet = Array.isArray(props.trnsTypes) ? new Set(props.trnsTypes) : null
  const start = props.dates?.start
  const end = props.dates?.end

  const hasFilters = typesSet || start !== undefined || end !== undefined || walletsSet || categoriesSet || tagsSet

  const result = hasFilters
    ? trnsIds.filter((id) => {
        const trn = props.trnsItems?.[id]
        if (!trn)
          return false
        if (typesSet && !typesSet.has(trn.type))
          return false
        if (start !== undefined && trn.date < start)
          return false
        if (end !== undefined && trn.date > end)
          return false
        if (walletsSet) {
          const matchesWallet = trn.type === TrnType.Transfer
            ? walletsSet.has(trn.expenseWalletId) || walletsSet.has(trn.incomeWalletId)
            : walletsSet.has(trn.walletId)
          if (!matchesWallet)
            return false
        }
        if (categoriesSet && !categoriesSet.has(trn.categoryId))
          return false
        if (tagsSet) {
          // Herhangi bir seçili etiketi taşıyan işlemler (OR eşleşmesi).
          if (!trn.tagIds?.some(id => tagsSet.has(id)))
            return false
        }
        return true
      })
    : trnsIds

  // Girdiyi ASLA mutasyona uğratma (O-1): filtre yokken `result`, çağıranın
  // `props.trnsIds` dizisinin TA KENDİSİDİR — yerinde .sort() onu da yeniden
  // sıralar ve çağıranın kendi sırası sessizce bozulur. Önce kopyala.
  if (props.sort) {
    return result
      .slice()
      .sort((a, b) => (props.trnsItems?.[b]?.date ?? 0) - (props.trnsItems?.[a]?.date ?? 0))
  }

  return result
}
