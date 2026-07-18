// @vitest-environment happy-dom
import { createPinia } from 'pinia'
import { beforeAll, describe, expect, it } from 'vitest'
import { createApp } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import App from './App.vue'
import { i18n } from './plugins/i18n'
import { vuetify } from './plugins/vuetify'

/**
 * BOOT SMOKE TESTİ — "uygulama hatasız açılıyor mu?".
 *
 * Gerçek `App.vue`'yu, `main.ts` ile AYNI eklenti yığınıyla (pinia + router +
 * vuetify + i18n) mount eder ve kabuğun (skip-link, v-app) render olduğunu
 * doğrular. Amaç NATIVE davranışı test etmek değil (o E2E'nin işi); bir
 * eklentinin eksik kalması, bozuk bir global import ya da App setup'ında fırlayan
 * bir hata gibi ÖNYÜKLEME regresyonlarını yakalamak.
 *
 * Rotalar bilinçli olarak bir stub'a indirgenir: gerçek sayfaları yüklemek
 * testi sayfa-içi ayrıntılara bağlar; burada test edilen App KABUĞUDUR.
 * `init()` zaten `isTauriRuntime()` ile korunuyor — Tauri dışı ortamda SQLite'a
 * hiç dokunmaz, yalnız uyarı basıp döner.
 */

beforeAll(() => {
  // happy-dom bunları sağlamaz; VueUse (usePreferredDark) ve Vuetify layout ister.
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false
      }) as unknown as MediaQueryList
  }
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

describe('uygulama önyüklemesi', () => {
  function boot() {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', name: 'home', component: { template: '<div>home</div>' } }]
    })
    const el = document.createElement('div')
    document.body.appendChild(el)
    const app = createApp(App)
    app.use(createPinia())
    app.use(router)
    app.use(vuetify)
    app.use(i18n)
    app.mount(el)
    return { el, app }
  }

  it('kabuk hatasız mount olur ve skip-link render edilir', () => {
    const { el, app } = boot()
    // v-app her zaman kökte olmalı — Vuetify düzgün kurulduysa.
    expect(el.querySelector('.v-application')).not.toBeNull()
    // Erişilebilirlik skip-link'i App şablonunda doğrudan durur (router-view dışında).
    expect(el.querySelector('.skip-link')).not.toBeNull()
    app.unmount()
  })
})
