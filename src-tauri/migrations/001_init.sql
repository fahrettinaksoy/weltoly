-- Weltoly başlangıç şeması (finapp AppSchema karşılığı).
-- Tüm id'ler istemci tarafında üretilen metin UUID'ler (FK kısıtı yok).
-- Boolean'lar INTEGER 0/1, zaman damgaları INTEGER (ms-epoch), sütunlar camelCase.

CREATE TABLE IF NOT EXISTS categories (
  id                  TEXT PRIMARY KEY,
  color               TEXT,
  icon                TEXT,
  name                TEXT,
  parentId            TEXT,            -- null = kök
  showInLastUsed      INTEGER,
  showInQuickSelector INTEGER,
  updatedAt           INTEGER,
  userId              TEXT
);
CREATE INDEX IF NOT EXISTS idx_categories_user   ON categories (userId);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories (parentId);

CREATE TABLE IF NOT EXISTS wallets (
  id               TEXT PRIMARY KEY,
  color            TEXT,
  creditLimit      REAL,
  currency         TEXT,
  "desc"           TEXT,
  isArchived       INTEGER,
  isExcludeInTotal INTEGER,
  isWithdrawal     INTEGER,
  name             TEXT,
  "order"          INTEGER,
  type             TEXT,
  updatedAt        INTEGER,
  userId           TEXT
);
CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets (userId);

CREATE TABLE IF NOT EXISTS trns (
  id             TEXT PRIMARY KEY,
  amount         REAL,
  categoryId     TEXT,
  date           INTEGER,
  "desc"         TEXT,
  expenseAmount  REAL,
  expenseWalletId TEXT,
  incomeAmount   REAL,
  incomeWalletId TEXT,
  type           INTEGER,
  updatedAt      INTEGER,
  userId         TEXT,
  walletId       TEXT
);
CREATE INDEX IF NOT EXISTS idx_trns_user      ON trns (userId);
CREATE INDEX IF NOT EXISTS idx_trns_user_date ON trns (userId, date);
CREATE INDEX IF NOT EXISTS idx_trns_wallet    ON trns (walletId);
CREATE INDEX IF NOT EXISTS idx_trns_category  ON trns (categoryId);

CREATE TABLE IF NOT EXISTS user_settings (
  id           TEXT PRIMARY KEY,
  baseCurrency TEXT,
  locale       TEXT,
  userId       TEXT
);

CREATE TABLE IF NOT EXISTS rates (
  id        TEXT PRIMARY KEY,
  date      TEXT,
  rates     TEXT,            -- JSON: Record<currency, number>
  source    TEXT,
  updatedAt INTEGER
);
CREATE INDEX IF NOT EXISTS idx_rates_date ON rates (date);

-- Senkron (Faz 5) hazırlığı: yerel mutasyon kuyruğu. Şimdilik pasif.
CREATE TABLE IF NOT EXISTS outbox (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  tableName TEXT NOT NULL,
  rowId     TEXT NOT NULL,
  op        TEXT NOT NULL,   -- 'upsert' | 'delete'
  payload   TEXT,            -- JSON
  createdAt INTEGER NOT NULL
);
