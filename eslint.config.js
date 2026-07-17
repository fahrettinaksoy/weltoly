import antfu from '@antfu/eslint-config'

// Kod tabanı zaten @antfu stilinde (tek tırnak, noktalı virgülsüz, sıralı importlar);
// bu config o stili resmileştirir ve CI'da zorunlu kılar (Y-6).
export default antfu({
  vue: true,
  typescript: true,

  // Biçimlendiriciler kapalı: markdown/toml/yaml dosyaları (docs, Cargo.toml,
  // release.yml) bu kuralların KAPSAMI DIŞINDA. Açık bırakılınca dokümanları ve
  // Rust manifestini de yeniden biçimlendiriyor — lint'in işi kod stili.
  markdown: false,
  yaml: false,
  toml: false,
  jsonc: false,

  ignores: [
    'dist',
    'src-tauri/target',
    'src-tauri/gen',
    '**/*.d.ts', // auto-imports.d.ts / components.d.ts ÜRETİLİR — elle düzenlenmez
  ],
})
