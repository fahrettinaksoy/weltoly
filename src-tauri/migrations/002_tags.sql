-- Etiketler (tags): kategorilerden bağımsız, işlemlere çoklu atanabilen serbest etiketler.
-- Tag tanımları ayrı tabloda; işleme atama, trns.tagIds JSON dizisi olarak saklanır
-- (mevcut JSON kolon deseni — rates.rates gibi — ile tutarlı, FK/junction gerekmez).

CREATE TABLE IF NOT EXISTS tags (
  id        TEXT PRIMARY KEY,
  name      TEXT,
  color     TEXT,
  updatedAt INTEGER,
  userId    TEXT
);
CREATE INDEX IF NOT EXISTS idx_tags_user ON tags (userId);

-- İşleme atanan etiket id'leri (JSON: string[]). null/'' = etiketsiz.
ALTER TABLE trns ADD COLUMN tagIds TEXT;
