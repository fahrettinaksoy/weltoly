import { z } from 'zod'

import { colorsArray } from '@/features/color/colors'
import { random } from '@/shared/lib/random'

export type TagId = string

export const tagFormSchema = z.object({
  name: z.string().trim().min(1).default(''),
  color: z.string().default(() => random(colorsArray)),
  desc: z.string().default('')
})

export type TagForm = z.infer<typeof tagFormSchema>

export type TagItem = TagForm & {
  updatedAt?: number
}

export type TagItemWithId = TagItem & {
  id: TagId
}

export type Tags = Record<TagId, TagItem>
