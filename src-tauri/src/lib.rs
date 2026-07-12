// Weltoly - Tauri arka uç girişi.
// Rust komutları (calling-rust): https://tauri.app/develop/calling-rust/
// Faz 1'de tauri-plugin-sql (SQLite) burada init edilecek.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
