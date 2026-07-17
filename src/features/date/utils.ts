import type { Duration } from 'date-fns'
import type { Period, Range } from '@/features/date/types'

import {
  add,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns'

// weekStartsOn: 0 = Pazar, 1 = Pazartesi (ayardan gelir; varsayılan Pazartesi).
type WeekStartsOn = 0 | 1 | 2 | 3 | 4 | 5 | 6

export function getStartOf(date: Date, intervalType: Period, weekStartsOn: WeekStartsOn = 1): Date {
  switch (intervalType) {
    case 'year': return startOfYear(date)
    case 'month': return startOfMonth(date)
    case 'week': return startOfWeek(date, { weekStartsOn })
    case 'day': return startOfDay(date)
  }
}

export function getEndOf(date: Date, intervalType: Period, weekStartsOn: WeekStartsOn = 1): Date {
  switch (intervalType) {
    case 'year': return endOfYear(date)
    case 'month': return endOfMonth(date)
    case 'week': return endOfWeek(date, { weekStartsOn })
    case 'day': return endOfDay(date)
  }
}

export function toDuration(period: Period, value: number): Duration {
  switch (period) {
    case 'day': return { days: value }
    case 'week': return { weeks: value }
    case 'month': return { months: value }
    case 'year': return { years: value }
  }
}

/** offset periyot kadar kaydırılmış tarihin, o periyottaki [başlangıç, bitiş] aralığı. offset<0 = geçmiş. */
export function rangeForPeriod(period: Period, offset: number, weekStartsOn: WeekStartsOn = 1): Range {
  const d = add(new Date(), toDuration(period, offset))
  return {
    start: getStartOf(d, period, weekStartsOn).getTime(),
    end: getEndOf(d, period, weekStartsOn).getTime(),
  }
}
