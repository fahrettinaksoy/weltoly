// Weltoly - Tauri arka uç girişi.
// Yerel veri katmanı: tauri-plugin-sql (SQLite, bundled) + tauri-plugin-store.

mod tx;

use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create base tables (categories, wallets, trns, user_settings, rates, outbox)",
            sql: include_str!("../migrations/001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add tags table and trns.tagIds column",
            sql: include_str!("../migrations/002_tags.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "add desc column to categories and tags",
            sql: include_str!("../migrations/003_desc.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "add user_settings.defaultWalletId",
            sql: include_str!("../migrations/004_default_wallet.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "add wallets.icon",
            sql: include_str!("../migrations/005_wallet_icon.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "add user_settings.rateSource and rates.rateDate",
            sql: include_str!("../migrations/006_rate_source.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "trns NOT NULL + CHECK constraints (type/amount/shape)",
            sql: include_str!("../migrations/007_trns_constraints.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        // Y-3: çok-adımlı yazma (mutasyon + outbox) tek transaction'da.
        .invoke_handler(tauri::generate_handler![tx::run_tx])
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:weltoly.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
