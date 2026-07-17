import { z } from 'zod'

import { colorsArray } from '@/features/color/colors'
import icons from '@/shared/icons'
import { random } from '@/shared/lib/random'

export type CategoryId = string

export const categoryFormSchema = z.object({
  color: z.string().default(() => random(colorsArray)),
  desc: z.string().default(''),
  icon: z.string().trim().min(1).default(() => random(random(icons))),
  name: z.string().trim().min(1).default(''),
  parentId: z.union([z.string(), z.literal(0)]).default(0),
  showInLastUsed: z.boolean().default(true),
  showInQuickSelector: z.boolean().default(false),
})

export type CategoryForm = z.infer<typeof categoryFormSchema>

export type CategoryItem = CategoryForm & {
  updatedAt?: number
}

export type CategoryItemWithId = CategoryItem & {
  id: CategoryId
}

export type Categories = Record<CategoryId, CategoryItem> & Record<'transfer', CategoryItem>

export interface AddCategoryParams {
  id: CategoryId
  isUpdateChildCategoriesColor: boolean
  nextChildIds?: CategoryId[]
  values: CategoryItem
}
