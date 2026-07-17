// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { createVuetify } from 'vuetify'
import { createRules } from 'vuetify/labs/rules'

import { themeConfig } from '@/plugins/vuetify/theme'

/**
 * Formlardaki `:rules="['required']"` string alias'ı ancak rules plugin'i
 * kuruluysa çözülür (main.ts → createRulesPlugin). Kurulmazsa Vuetify
 * `rules?.resolve(fn) ?? toRef(fn)` yoluna düşer, string bir kural olarak
 * çalışmaz ve BOŞ ALAN SESSİZCE GEÇER — ne build ne typecheck bunu görür.
 * Bu test o zinciri kilitler.
 */
describe('doğrulama kuralları', () => {
  const vuetify = createVuetify({
    theme: themeConfig,
    locale: { locale: 'tr', messages: { tr: { rules: { required: 'Bu alan zorunludur' } } } },
  })
  const rules = createRules({}, vuetify.locale)

  it('\'required\' alias\'ı çalıştırılabilir bir kurala çözülüyor', () => {
    const resolved = rules.resolve(() => ['required'])
    expect(resolved.value).toHaveLength(1)
    expect(typeof resolved.value[0]).toBe('function')
  })

  it('boş değer reddedilir ve mesaj döner', () => {
    const rule = rules.resolve(() => ['required']).value[0] as (v: unknown) => true | string
    for (const empty of ['', null, undefined])
      expect(rule(empty), `boş: ${JSON.stringify(empty)}`).toBe('Bu alan zorunludur')
  })

  it('dolu değer kabul edilir', () => {
    const rule = rules.resolve(() => ['required']).value[0] as (v: unknown) => true | string
    expect(rule('aksoy')).toBe(true)
  })

  it('0 geçerli sayılır — sayısal alanlarda sıfır boş değildir', () => {
    const rule = rules.resolve(() => ['required']).value[0] as (v: unknown) => true | string
    expect(rule(0)).toBe(true)
  })
})
