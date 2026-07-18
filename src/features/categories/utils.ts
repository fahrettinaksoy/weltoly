import type { Categories, CategoryId, CategoryItem } from '@/features/categories/types'

export function getTransactibleCategoriesIds(items: Categories, ids?: CategoryId[]) {
  if (!items) return []

  const childrenMap = new Map<CategoryId, CategoryId[]>()
  for (const id of Object.keys(items)) {
    const parentId = items[id]?.parentId
    if (parentId) {
      const pid = String(parentId)
      if (!childrenMap.has(pid)) childrenMap.set(pid, [])
      childrenMap.get(pid)!.push(id)
    }
  }

  const seen = new Set<CategoryId>()
  const result: CategoryId[] = []

  for (const id of ids ?? Object.keys(items)) {
    const category = items[id]
    const children = childrenMap.get(id)
    if (category?.parentId === 0 && children?.length) {
      for (const childId of children) {
        if (!seen.has(childId)) {
          seen.add(childId)
          result.push(childId)
        }
      }
    } else if (!seen.has(id)) {
      seen.add(id)
      result.push(id)
    }
  }

  return result
}

/**
 * Kategorinin KÖKÜNÜ verir; kök zaten kendisiyse ya da üst kategori
 * çözülemiyorsa kategorinin kendisine düşer.
 *
 * O-11: eskiden `category.parentId` doğrudan döndürülüyordu. Üst kategori
 * SİLİNMİŞSE (FK yok, dangling referans mümkün) geriye artık var olmayan bir id
 * dönüyordu; çağıran onu `items[id]` ile arayınca `undefined` buluyor ve pastada
 * İSİMSİZ bir dilim çiziliyordu. Hata sessiz: grafik yine çizilir, sadece
 * anlamsız bir dilim taşır. Artık üst kategorinin GERÇEKTEN var olduğu
 * doğrulanır; yoksa yaprağın kendisi kök sayılır.
 */
export function getParentCategoryIdOrReturnSame(
  items: Categories,
  categoryId: CategoryId
): CategoryId {
  const category = items[categoryId]
  if (!category || category.parentId === 0) return categoryId

  const parentId = category.parentId
  if (!parentId) return categoryId

  return items[parentId] ? parentId : categoryId
}

export function compareCategoriesByParentAndName(
  a: CategoryItem,
  b: CategoryItem,
  items: Categories
): number {
  const parentNameA = items[a.parentId]?.name ?? ''
  const parentNameB = items[b.parentId]?.name ?? ''
  return parentNameA.localeCompare(parentNameB) || a.name.localeCompare(b.name)
}

export function compareCategoryIds(idA: CategoryId, idB: CategoryId, items: Categories): number {
  const catA = items[idA]
  const catB = items[idB]
  if (!catA || !catB) return 0
  return compareCategoriesByParentAndName(catA, catB, items)
}

export function computeChildrenDiff(
  prev: CategoryId[],
  next: CategoryId[]
): { added: CategoryId[]; removed: CategoryId[] } {
  const prevSet = new Set(prev)
  const nextSet = new Set(next)
  return {
    added: next.filter((id) => !prevSet.has(id)),
    removed: prev.filter((id) => !nextSet.has(id))
  }
}
