-- trns tablosuna NOT NULL + CHECK kısıtları: şeklen bozuk bir işlemin DİSKE
-- yazılmasını imkânsız kılar.
--
-- NEDEN ŞİMDİ: Faz 5'te senkron motoru uzak taraftan gelen satırları yazacak.
-- O satırlar TypeScript tiplerimizden geçmez — tek savunma hattı şema. Bugün
-- "amount her zaman dolu" gibi bir varsayım yalnız kod okuyanın kafasında;
-- yarın uzak bir eş bozuk satır gönderirse sessizce kabul edilir.
--
-- HER KISIT MEVCUT VERİYE KARŞI ÖLÇÜLDÜ (181 işlem, 0 ihlal). Ölçmeden
-- eklenseydi migration kullanıcının DB'sinde patlar, uygulama açılmazdı.
--
-- SQLite `ALTER TABLE ... ADD CONSTRAINT` desteklemez → tablo yeniden inşa
-- edilir (resmî 12 adımlı yordam: yeni tablo, kopyala, eskiyi bırak, adlandır).

-- Yeniden inşa sırasında FK'lar kapalı olmalı; sqlx bağlantıyı foreign_keys=ON
-- ile açar ve eski tabloyu DROP etmek referansları geçici olarak koparır.
PRAGMA foreign_keys = OFF;

CREATE TABLE trns_new (
  id              TEXT PRIMARY KEY,
  amount          REAL,
  categoryId      TEXT    NOT NULL,
  date            INTEGER NOT NULL,
  "desc"          TEXT,
  expenseAmount   REAL,
  expenseWalletId TEXT,
  incomeAmount    REAL,
  incomeWalletId  TEXT,
  type            INTEGER NOT NULL,
  updatedAt       INTEGER NOT NULL,
  userId          TEXT    NOT NULL,
  walletId        TEXT,
  tagIds          TEXT,

  -- 0=gider, 1=gelir, 2=transfer. TrnType (src/features/trns/types.ts) ile
  -- AYNI olmak zorunda; oraya yeni bir tür eklenirse buraya da migration gerekir.
  CONSTRAINT trns_type_valid CHECK (type IN (0, 1, 2)),

  -- Tutarlar negatif olamaz: yön `type` ile taşınır, işaretle DEĞİL. Negatif bir
  -- tutar toplamları sessizce ters çevirirdi (gider gelir gibi davranırdı).
  CONSTRAINT trns_amounts_non_negative CHECK (
    (amount IS NULL OR amount >= 0)
    AND (expenseAmount IS NULL OR expenseAmount >= 0)
    AND (incomeAmount IS NULL OR incomeAmount >= 0)
  ),

  -- ŞEKİL DEĞİŞMEZİ — bu migration'ın asıl değeri.
  --
  -- Transfer (type=2) İKİ cüzdan kullanır (expense*/income*) ve tekil
  -- walletId/amount alanlarını BOŞ bırakır. Gelir/gider (0,1) ise tam tersi.
  -- İkisinin karışması en sinsi bozulma: satır "geçerli" görünür ama hangi
  -- cüzdana ait olduğu belirsizdir; bakiye hesabı onu ya iki kez sayar ya hiç.
  CONSTRAINT trns_shape_matches_type CHECK (
    (type = 2
      AND walletId IS NULL AND amount IS NULL
      AND expenseWalletId IS NOT NULL AND incomeWalletId IS NOT NULL
      AND expenseAmount IS NOT NULL AND incomeAmount IS NOT NULL)
    OR
    (type IN (0, 1)
      AND walletId IS NOT NULL AND amount IS NOT NULL
      AND expenseWalletId IS NULL AND incomeWalletId IS NULL)
  )
);

-- Sütunlar açıkça sayılır: `SELECT *` sütun sırasına bel bağlar ve ileride
-- bir sütun eklenirse sessizce yanlış hizalanır.
INSERT INTO trns_new (
  id, amount, categoryId, date, "desc", expenseAmount, expenseWalletId,
  incomeAmount, incomeWalletId, type, updatedAt, userId, walletId, tagIds
)
SELECT
  id, amount, categoryId, date, "desc", expenseAmount, expenseWalletId,
  incomeAmount, incomeWalletId, type, updatedAt, userId, walletId, tagIds
FROM trns;

DROP TABLE trns;
ALTER TABLE trns_new RENAME TO trns;

-- İndeksler tabloyla birlikte düşer → yeniden kurulur (eski tanımlarla birebir).
CREATE INDEX idx_trns_user      ON trns (userId);
CREATE INDEX idx_trns_user_date ON trns (userId, date);
CREATE INDEX idx_trns_wallet    ON trns (walletId);
CREATE INDEX idx_trns_category  ON trns (categoryId);

PRAGMA foreign_keys = ON;

-- KASITLI OLARAK YOK: FK(categoryId -> categories.id).
-- 'transfer' ve 'adjustment' sözde-kategorilerdir; `categories` tablosunda
-- SATIRLARI YOKTUR (store'da sabit olarak enjekte edilirler). FK eklenseydi
-- mevcut 181 işlemin 65'i (%36) REDDEDİLİRDİ. Ölçüldü, bkz. CODE-REVIEW-2026-07-17.
