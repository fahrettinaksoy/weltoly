// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { createApp, h } from 'vue'
import { createVuetify } from 'vuetify'

import { themeConfig } from '@/plugins/vuetify/theme'

/**
 * Snackbar zamanlayıcısının rengi `${color}-darken-2` tema rengine dayanır
 * (stores/ui.ts). Bu renkler theme.ts'teki `variations` ayarından ÜRETİLİR —
 * ayar daralırsa (ör. darken azaltılırsa) renk sessizce çözülmez ve çubuk
 * yanlış renk alır. Bu test o bağı kilitler.
 */
describe('tema varyasyonları', () => {
  const vuetify = createVuetify({ theme: themeConfig })
  const app = createApp({ render: () => h('div') })
  app.use(vuetify)
  app.mount(document.createElement('div'))

  const colors = vuetify.theme.current.value.colors

  it.each(['success', 'error', 'warning', 'info'])('%s-darken-2 üretiliyor', (c) => {
    expect(colors[`${c}-darken-2`]).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('darken-2 taban renkten GERÇEKTEN koyu', () => {
    // Tema renkleri hex string olarak üretilir; tip birleşimi daha geniş olduğu
    // için burada daraltılır (yukarıdaki test şeklin hex olduğunu zaten doğruluyor).
    const luminance = (value: unknown) => {
      const n = Number.parseInt(String(value).slice(1), 16)
      return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114
    }
    for (const c of ['success', 'error', 'warning', 'info'])
      expect(luminance(colors[`${c}-darken-2`]), c).toBeLessThan(luminance(colors[c]))
  })
})
