// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { createApp, h } from 'vue'
import { createVuetify } from 'vuetify'
// Vuetify 4: VDateInput labs'tan çıkıp stable bileşen oldu (v3'te 'vuetify/labs/VDateInput').
import { VDateInput } from 'vuetify/components/VDateInput'

import { defaults } from '@/plugins/vuetify/defaults'

/**
 * VDateInput, VTextField'ın proplarını `makeVTextFieldProps()` ile KENDİ propu
 * olarak tanımlar ve içteki VTextField'a `VTextField.filterProps(props)` ile
 * AÇIKÇA geçirir (VDateInput.js:44 ve :206). Açıkça geçirilen prop, hedef
 * bileşenin default'unu ezdiği için `VTextField: { variant: 'outlined' }`
 * global ayarı bu alana İNMEZ — alan VField'ın `default: 'filled'` değeriyle
 * dolgulu render edilir ve formdaki tek "farklı görünen" alan olur.
 *
 * Bu testler o davranışı kilitler: defaults.ts'ten VDateInput bloğu silinirse
 * (ya da "VTextField zaten ayarlı, bu fazlalık" diye sadeleştirilirse) tarih
 * alanı sessizce dolgulu görünüme döner. Sessiz görsel regresyon = testle
 * yakalanmalı.
 */
describe('vDateInput varsayılanları', () => {
  function mountDateInput() {
    const vuetify = createVuetify({ defaults })
    const el = document.createElement('div')
    document.body.appendChild(el)
    const app = createApp(h(VDateInput)).use(vuetify)
    app.mount(el)
    return { el, app }
  }

  it('outlined variant ile render edilir (VTextField default\'u inmediği için ayrıca verilmeli)', () => {
    const { el, app } = mountDateInput()
    expect(el.querySelector('.v-field--variant-outlined')).not.toBeNull()
    expect(el.querySelector('.v-field--variant-filled')).toBeNull()
    app.unmount()
  })

  it('takvim ikonu alanın İÇİNDE, dışında değil', () => {
    const { el, app } = mountDateInput()
    // Dış prepend alanı hiç render edilmemeli (prependIcon: '' → falsy).
    expect(el.querySelector('.v-input__prepend')).toBeNull()
    // İkon alanın içindeki prepend-inner'da olmalı.
    expect(el.querySelector('.v-field__prepend-inner .mdi-calendar')).not.toBeNull()
    app.unmount()
  })
})
