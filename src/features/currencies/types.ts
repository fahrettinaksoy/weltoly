import { z } from 'zod'

export type CurrencyCode = string

export const ratesSchema = z.record(z.string(), z.number())

export type Rates = z.infer<typeof ratesSchema>
