import {
  endOfDay, endOfMonth, endOfWeek, endOfYear,
  startOfDay, startOfMonth, startOfWeek, startOfYear,
} from 'date-fns'

import type { Period } from '@/features/date/types'

// Faz 2 için gereken minimal set (trns store getRange). Faz 3'te aralık/interval mantığı eklenecek.

export function getStartOf(date: Date, intervalType: Period): Date {
  switch (intervalType) {
    case 'year': return startOfYear(date)
    case 'month': return startOfMonth(date)
    case 'week': return startOfWeek(date, { weekStartsOn: 1 })
    case 'day': return startOfDay(date)
  }
}

export function getEndOf(date: Date, intervalType: Period): Date {
  switch (intervalType) {
    case 'year': return endOfYear(date)
    case 'month': return endOfMonth(date)
    case 'week': return endOfWeek(date, { weekStartsOn: 1 })
    case 'day': return endOfDay(date)
  }
}
