import { describe, expect, it } from 'vitest'

import { getStartOf, rangeForPeriod } from './utils'

describe('rangeForPeriod', () => {
  it('her periyotta start <= end', () => {
    for (const p of ['day', 'week', 'month', 'year'] as const) {
      const r = rangeForPeriod(p, 0)
      expect(r.start).toBeLessThanOrEqual(r.end)
    }
  })

  it('geçmiş offset daha erken bir aralık verir', () => {
    const cur = rangeForPeriod('month', 0)
    const prev = rangeForPeriod('month', -1)
    expect(prev.end).toBeLessThan(cur.start)
  })

  it('gün aralığı günün başına hizalanır', () => {
    const r = rangeForPeriod('day', 0)
    expect(r.start).toBe(getStartOf(new Date(), 'day').getTime())
  })
})
