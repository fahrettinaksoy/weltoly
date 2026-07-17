// Faz 2 için minimal tarih tipleri. Faz 3 (stat) ile genişletilecek.
export type Period = 'day' | 'week' | 'month' | 'year'

export interface Range {
  start: number
  end: number
}
