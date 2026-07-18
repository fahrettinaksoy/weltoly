// Kullanıcının seçebileceği ana renkler (20+).
export const primaryPalette: string[] = [
  '#635bff',
  '#7c74ff',
  '#4f46e5',
  '#2563eb',
  '#0091ff',
  '#0ea5e9',
  '#06b6d4',
  '#14b8a6',
  '#10b981',
  '#22c55e',
  '#84cc16',
  '#eab308',
  '#f59e0b',
  '#f97316',
  '#ef4444',
  '#e5484d',
  '#ec4899',
  '#d946ef',
  '#a855f7',
  '#8b5cf6',
  '#64748b',
  '#0d9488'
]

export const defaultPrimary = '#635bff'

// --- Nötr paletler (arka plan / yüzey tonları) ------------------------------
export type NeutralKey = 'slate' | 'gray' | 'zinc' | 'stone' | 'neutral'
export interface NeutralColors {
  background: string
  surface: string
  variant: string
}

export const neutralPalettes: Record<NeutralKey, { light: NeutralColors; dark: NeutralColors }> = {
  slate: {
    light: { background: '#f6f7f9', surface: '#ffffff', variant: '#eceef2' },
    dark: { background: '#0f1115', surface: '#171a21', variant: '#232833' }
  },
  gray: {
    light: { background: '#f9fafb', surface: '#ffffff', variant: '#f3f4f6' },
    dark: { background: '#111113', surface: '#1a1a1d', variant: '#27272a' }
  },
  zinc: {
    light: { background: '#fafafa', surface: '#ffffff', variant: '#f4f4f5' },
    dark: { background: '#0c0c0e', surface: '#18181b', variant: '#27272a' }
  },
  stone: {
    light: { background: '#f8f7f5', surface: '#ffffff', variant: '#f0efec' },
    dark: { background: '#12100e', surface: '#1c1a17', variant: '#292524' }
  },
  neutral: {
    light: { background: '#f7f7f7', surface: '#ffffff', variant: '#efefef' },
    dark: { background: '#0d0d0d', surface: '#171717', variant: '#262626' }
  }
}

export const neutralKeys = Object.keys(neutralPalettes) as NeutralKey[]
export const defaultNeutral: NeutralKey = 'slate'

export const DEFAULT_RADIUS = 12
export const MIN_RADIUS = 0
export const MAX_RADIUS = 24
