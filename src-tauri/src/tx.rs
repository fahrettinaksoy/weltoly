//! Transactional outbox (Y-3) — çok-adımlı yazmayı TEK sqlx transaction'ında yapar.
//!
//! # Neden Rust tarafında
//!
//! JS'ten gerçek transaction KURULAMIYOR: `tauri-plugin-sql` her `execute`
//! çağrısını havuzdan alınan (muhtemelen FARKLI) bir bağlantıda çalıştırır.
//! `BEGIN` bir bağlantıya, `INSERT` başka bir bağlantıya düşebilir → transaction
//! hiçbir şeyi kapsamaz ve bu SESSİZDİR: her şey çalışıyor görünür, ta ki araya
//! bir çökme girene kadar.
//!
//! Somut sonucu: ana yazma ile outbox kaydı iki ayrı `execute` olduğu için
//! arada çökme olursa mutasyon kalıcı olur, outbox kaydı oluşmaz → Faz 5
//! senkronunda KALICI sapma (uzak taraf o değişikliği hiç görmez).
//!
//! # Havuz neden ödünç alınıyor
//!
//! Kendi bağlantımızı açmak iki sorun getirirdi: (1) DB dosya yolunu yeniden
//! çözmek gerekir ve yanlış yol SESSİZCE başka bir dosyaya yazar; (2) ikinci bir
//! bağlantı WAL kilidi için plugin'le yarışır. `DbInstances` public olduğu için
//! plugin'in KENDİ havuzunu alıyoruz — tek doğruluk kaynağı.

use serde::{Deserialize, Serialize};
use sqlx::{Pool, Sqlite};
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_sql::{DbInstances, DbPool};

/// Migration anahtarıyla (lib.rs) ve JS tarafındaki DB_URL ile AYNI olmalı.
const DB_URL: &str = "sqlite:weltoly.db";

/// Tek bir SQL ifadesi + parametreleri.
///
/// Parametreler `serde_json::Value` olarak gelir; SQLite'a bind edilirken
/// JS tiplerine karşılık gelen dar bir kümeye indirgenir (aşağıya bkz).
#[derive(Debug, Deserialize)]
pub struct Stmt {
    pub sql: String,
    #[serde(default)]
    pub values: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct TxResult {
    /// Uygulanan ifade sayısı — çağıran beklediğiyle karşılaştırabilir.
    pub applied: usize,
}

/// Verilen ifadeleri TEK transaction'da sırayla çalıştırır.
///
/// Hepsi ya uygulanır ya hiçbiri: ilk hatada `?` ile erken çıkılır ve `tx`
/// düşerken sqlx otomatik ROLLBACK yapar (commit çağrılmadıysa). Bu yüzden
/// açık bir rollback dalı YOK — unutulabilecek bir adım bırakmamak için.
#[tauri::command]
pub async fn run_tx<R: Runtime>(
    app: AppHandle<R>,
    statements: Vec<Stmt>,
) -> Result<TxResult, String> {
    let instances = app.state::<DbInstances>();
    let map = instances.0.read().await;

    // DbPool public bir enum; `sqlite()` erişimcisi upstream'de yorum satırında
    // olduğu için varyantı doğrudan eşleştiriyoruz. Yalnız `sqlite` özelliği
    // açık olduğundan enum'un tek varyantı var — başka dal eklemek derleyicide
    // "unreachable pattern" uyarısı verir.
    let pool: &Pool<Sqlite> = match map.get(DB_URL) {
        Some(DbPool::Sqlite(p)) => p,
        // Plugin DB'yi `Database.load()` ile lazy açıyor; JS hiç yüklemediyse
        // burası boştur. Sessizce başarılı dönmek en kötüsü olurdu.
        None => return Err(format!("veritabanı yüklenmemiş: {DB_URL}")),
    };

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    for stmt in &statements {
        let mut q = sqlx::query(&stmt.sql);
        for v in &stmt.values {
            q = bind_value(q, v);
        }
        q.execute(&mut *tx).await.map_err(|e| {
            // SQL'i de veriyoruz: hangi ifadenin patladığı yoksa bulunamaz.
            format!("transaction başarısız ({}): {e}", stmt.sql)
        })?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(TxResult { applied: statements.len() })
}

type SqliteQuery<'a> = sqlx::query::Query<'a, Sqlite, sqlx::sqlite::SqliteArguments<'a>>;

/// JSON değerini SQLite'a bind eder.
///
/// Kapsam bilinçli olarak dar: JS tarafı (transforms.ts) SQLite'a yalnız
/// string / number / boolean / null yazıyor. Tanınmayan bir şey (nesne, dizi)
/// gelirse JSON metnine çevrilir — sessizce NULL'a düşürmek veri kaybı olurdu.
///
/// Tamsayı/ondalık ayrımı ŞART: `as_i64` denenmeden `as_f64` kullanılsaydı tüm
/// zaman damgaları ve 0/1 boolean'lar REAL olarak yazılırdı.
fn bind_value<'a>(q: SqliteQuery<'a>, v: &'a serde_json::Value) -> SqliteQuery<'a> {
    match v {
        serde_json::Value::Null => q.bind(None::<String>),
        serde_json::Value::Bool(b) => q.bind(*b),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                q.bind(i)
            } else {
                q.bind(n.as_f64().unwrap_or(0.0))
            }
        }
        serde_json::Value::String(s) => q.bind(s.as_str()),
        other => q.bind(other.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use sqlx::{sqlite::SqlitePoolOptions, Row};

    /// `run_tx`'in ÖZÜ: aynı havuzda, tek transaction, ilk hatada rollback.
    ///
    /// Komutun kendisi `AppHandle` istediği için burada test edilemez (Tauri
    /// runtime gerekir); bu yüzden aynı sqlx akışı bellek-içi bir DB üzerinde
    /// doğrulanır. Asıl kanıtlanan şey: `tx` commit edilmeden düşerse yazılanlar
    /// GERİ ALINIR — Y-3'ün tüm dayanağı bu.
    async fn setup() -> sqlx::Pool<sqlx::Sqlite> {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::query("CREATE TABLE t (id TEXT PRIMARY KEY, v TEXT)")
            .execute(&pool)
            .await
            .unwrap();
        pool
    }

    async fn count(pool: &sqlx::Pool<sqlx::Sqlite>) -> i64 {
        sqlx::query("SELECT COUNT(*) AS c FROM t")
            .fetch_one(pool)
            .await
            .unwrap()
            .get::<i64, _>("c")
    }

    #[tokio::test]
    async fn commit_applies_all() {
        let pool = setup().await;
        let mut tx = pool.begin().await.unwrap();
        sqlx::query("INSERT INTO t (id, v) VALUES ('a', '1')")
            .execute(&mut *tx)
            .await
            .unwrap();
        sqlx::query("INSERT INTO t (id, v) VALUES ('b', '2')")
            .execute(&mut *tx)
            .await
            .unwrap();
        tx.commit().await.unwrap();

        assert_eq!(count(&pool).await, 2);
    }

    /// Asıl senaryo: mutasyon yazıldı, İKİNCİ ifade patladı → hiçbiri kalmamalı.
    /// Eski kodda birincisi kalıcı olur, outbox kaydı oluşmazdı (sessiz sapma).
    #[tokio::test]
    async fn failure_rolls_back_everything() {
        let pool = setup().await;
        {
            let mut tx = pool.begin().await.unwrap();
            sqlx::query("INSERT INTO t (id, v) VALUES ('a', '1')")
                .execute(&mut *tx)
                .await
                .unwrap();
            // PK çakışması → hata. `?` ile erken çıkılırsa tx commit EDİLMEDEN düşer.
            let err = sqlx::query("INSERT INTO t (id, v) VALUES ('a', 'dup')")
                .execute(&mut *tx)
                .await;
            assert!(err.is_err(), "PK çakışması hata vermeliydi");
            // tx burada commit edilmeden kapsam dışına çıkıyor → otomatik ROLLBACK
        }
        assert_eq!(count(&pool).await, 0, "rollback sonrası hiçbir satır kalmamalı");
    }

    /// Yarım uygulama OLMAMALI: 3 ifadenin 3.'sü patlarsa ilk ikisi de gitmeli.
    #[tokio::test]
    async fn partial_apply_is_impossible() {
        let pool = setup().await;
        {
            let mut tx = pool.begin().await.unwrap();
            for id in ["a", "b"] {
                sqlx::query("INSERT INTO t (id, v) VALUES (?, 'x')")
                    .bind(id)
                    .execute(&mut *tx)
                    .await
                    .unwrap();
            }
            let bad = sqlx::query("INSERT INTO nonexistent_table (id) VALUES ('c')")
                .execute(&mut *tx)
                .await;
            assert!(bad.is_err());
        }
        assert_eq!(count(&pool).await, 0);
    }
}

/// `run_tx` KOMUTUNUN kendisini gerçek bir Tauri uygulaması + gerçek sql plugin'i
/// ile çalıştıran testler.
///
/// Yukarıdaki `tests` modülü yalnız sqlx akışını kanıtlıyor — asıl risk orada
/// değildi. Burada kanıtlanan, daha önce HİÇ test edilmemiş olan kısım:
/// plugin'in havuzunu `DbInstances`'tan gerçekten bulabiliyor muyuz, `DbPool`
/// varyantı eşleşiyor mu, sqlx sürümleri uyuşuyor mu, `Stmt` serde ile
/// çözülüyor mu.
#[cfg(test)]
mod app_tests {
    use tauri::test::{mock_builder, mock_context, noop_assets, MockRuntime};
    use tauri::App;
    use tauri_plugin_sql::{Migration, MigrationKind};

    use super::{run_tx, Stmt};

    fn stmt(sql: &str, values: Vec<serde_json::Value>) -> Stmt {
        Stmt { sql: sql.to_string(), values }
    }

    /// `DB_URL` `tx.rs`'de sabit olduğu için test de AYNI url'yi kullanmak
    /// zorunda. Plugin bunu app config dizinine eşliyor → identifier
    /// DEĞİŞTİRİLMEZSE test KULLANICININ GERÇEK weltoly.db'sini açardı.
    /// Benzersiz identifier tek koruma.
    fn build_app(identifier: &str) -> App<MockRuntime> {
        let mut ctx = mock_context(noop_assets());
        ctx.config_mut().identifier = identifier.to_string();
        // preload: plugin'in DB'yi setup'ta açıp migrate etmesini sağlar
        // (normalde JS `Database.load()` çağırır; testte JS yok).
        ctx.config_mut().plugins.0.insert(
            "sql".into(),
            serde_json::json!({ "preload": [super::DB_URL] }),
        );

        let migrations = vec![Migration {
            version: 1,
            description: "test schema",
            sql: "CREATE TABLE t (id TEXT PRIMARY KEY, n INTEGER, f REAL, s TEXT, b INTEGER);",
            kind: MigrationKind::Up,
        }];

        mock_builder()
            .plugin(
                tauri_plugin_sql::Builder::new()
                    .add_migrations(super::DB_URL, migrations)
                    .build(),
            )
            .build(ctx)
            .expect("mock app kurulamadı")
    }

    /// Her test kendi DB dosyasını alır: aynı dosyayı paylaşsalardı paralel
    /// koşan testler birbirinin satırlarını görür ve sonuçlar rastgeleleşirdi.
    fn fresh_app(name: &str) -> App<MockRuntime> {
        let id = format!("com.stackvo.weltoly.test-{name}");
        // Önceki koşudan kalan dosya varsa sil — testler tekrarlanabilir olmalı.
        if let Some(dir) = dirs_next_config_dir(&id) {
            let _ = std::fs::remove_file(dir.join("weltoly.db"));
        }
        build_app(&id)
    }

    fn dirs_next_config_dir(identifier: &str) -> Option<std::path::PathBuf> {
        let home = std::env::var_os("HOME")?;
        Some(
            std::path::PathBuf::from(home)
                .join("Library/Application Support")
                .join(identifier),
        )
    }

    async fn rows(app: &App<MockRuntime>) -> Vec<(String, i64)> {
        use sqlx::Row;
        use tauri::Manager;
        use tauri_plugin_sql::{DbInstances, DbPool};

        let instances = app.handle().state::<DbInstances>();
        let map = instances.0.read().await;
        let DbPool::Sqlite(pool) = map.get(super::DB_URL).unwrap();
        sqlx::query("SELECT id, COALESCE(n, -1) AS n FROM t ORDER BY id")
            .fetch_all(pool)
            .await
            .unwrap()
            .iter()
            .map(|r| (r.get::<String, _>("id"), r.get::<i64, _>("n")))
            .collect()
    }

    /// EN ÖNEMLİ TEST: komut gerçekten çalışıyor mu ve yazdıkları kalıcı mı?
    // multi_thread ŞART: sql plugin'inin setup'ı `block_in_place` kullanıyor,
    // o da tek iş parçacıklı runtime'da panikliyor ("can call blocking only when
    // running on the multi-threaded runtime").
    #[tokio::test(flavor = "multi_thread")]
    async fn command_commits_to_the_plugins_own_pool() {
        let app = fresh_app("commit");

        let res = run_tx(app.handle().clone(), vec![
            stmt("INSERT INTO t (id, n) VALUES ($1, $2)", vec![json_str("a"), json_num(1)]),
            stmt("INSERT INTO t (id, n) VALUES ($1, $2)", vec![json_str("b"), json_num(2)]),
        ])
        .await
        .expect("run_tx hata verdi");

        assert_eq!(res.applied, 2);
        // Okuma plugin'in havuzundan: yazma gerçekten O havuza gitti mi?
        assert_eq!(rows(&app).await, vec![("a".into(), 1), ("b".into(), 2)]);
    }

    /// Y-3'ün TÜM DAYANAĞI: gerçek komutta da yarım uygulama imkânsız mı?
    // multi_thread ŞART: sql plugin'inin setup'ı `block_in_place` kullanıyor,
    // o da tek iş parçacıklı runtime'da panikliyor ("can call blocking only when
    // running on the multi-threaded runtime").
    #[tokio::test(flavor = "multi_thread")]
    async fn command_rolls_back_on_failure() {
        let app = fresh_app("rollback");

        let err = run_tx(app.handle().clone(), vec![
            stmt("INSERT INTO t (id, n) VALUES ($1, $2)", vec![json_str("a"), json_num(1)]),
            stmt("INSERT INTO nonexistent (id) VALUES ($1)", vec![json_str("b")]),
        ])
        .await
        .expect_err("hatalı SQL başarılı dönmemeliydi");

        // Hata mesajı hangi ifadenin patladığını söylemeli, yoksa teşhis edilemez.
        assert!(err.contains("nonexistent"), "hata SQL'i içermeli: {err}");
        // İlk INSERT geri alınmalı — eski kodda kalıcı olurdu.
        assert!(rows(&app).await.is_empty(), "rollback sonrası satır kalmamalı");
    }

    /// `bind_value`'nun gerçek komut yolundaki davranışı: tamsayı INTEGER kalmalı.
    /// `as_i64` denenmeseydi tüm zaman damgaları ve 0/1 boolean'lar REAL olurdu.
    // multi_thread ŞART: sql plugin'inin setup'ı `block_in_place` kullanıyor,
    // o da tek iş parçacıklı runtime'da panikliyor ("can call blocking only when
    // running on the multi-threaded runtime").
    #[tokio::test(flavor = "multi_thread")]
    async fn command_binds_types_correctly() {
        use sqlx::Row;
        use tauri::Manager;
        use tauri_plugin_sql::{DbInstances, DbPool};

        let app = fresh_app("types");

        run_tx(app.handle().clone(), vec![stmt(
            "INSERT INTO t (id, n, f, s, b) VALUES ($1, $2, $3, $4, $5)",
            vec![
                json_str("x"),
                json_num(1_752_000_000_000_i64), // zaman damgası
                serde_json::json!(1.5),
                json_str("merhaba"),
                serde_json::json!(true),
            ],
        )])
        .await
        .expect("run_tx hata verdi");

        let instances = app.handle().state::<DbInstances>();
        let map = instances.0.read().await;
        let DbPool::Sqlite(pool) = map.get(super::DB_URL).unwrap();
        let row = sqlx::query("SELECT typeof(n) tn, typeof(f) tf, typeof(s) ts, n, f, s, b FROM t")
            .fetch_one(pool)
            .await
            .unwrap();

        assert_eq!(row.get::<String, _>("tn"), "integer", "zaman damgası REAL'e düşmemeli");
        assert_eq!(row.get::<String, _>("tf"), "real");
        assert_eq!(row.get::<String, _>("ts"), "text");
        assert_eq!(row.get::<i64, _>("n"), 1_752_000_000_000);
        assert_eq!(row.get::<f64, _>("f"), 1.5);
        assert_eq!(row.get::<i64, _>("b"), 1);
    }

    /// NULL gerçekten NULL olarak gitmeli — "null" METNİ olarak değil.
    // multi_thread ŞART: sql plugin'inin setup'ı `block_in_place` kullanıyor,
    // o da tek iş parçacıklı runtime'da panikliyor ("can call blocking only when
    // running on the multi-threaded runtime").
    #[tokio::test(flavor = "multi_thread")]
    async fn command_binds_null() {
        let app = fresh_app("null");

        run_tx(app.handle().clone(), vec![stmt(
            "INSERT INTO t (id, n) VALUES ($1, $2)",
            vec![json_str("x"), serde_json::Value::Null],
        )])
        .await
        .expect("run_tx hata verdi");

        // COALESCE(n,-1) → -1 demek n gerçekten NULL demek.
        assert_eq!(rows(&app).await, vec![("x".into(), -1)]);
    }

    fn json_str(s: &str) -> serde_json::Value {
        serde_json::Value::String(s.to_string())
    }
    fn json_num(n: i64) -> serde_json::Value {
        serde_json::json!(n)
    }
}
