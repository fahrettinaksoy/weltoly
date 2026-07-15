-- Kategori ve etiketlere serbest açıklama alanı — cüzdanlardaki "desc" ile aynı desen.
--
-- NOT: desc bir SQL anahtar kelimesidir (ORDER BY ... DESC), bu yüzden kolon adı
-- çift tırnakla tanımlanır. Okuma/yazma tarafı zaten güvenli: buildUpsert
-- (services/db/mutations.ts) tüm kolon adlarını tırnaklayarak yazıyor.

ALTER TABLE categories ADD COLUMN "desc" TEXT;
ALTER TABLE tags ADD COLUMN "desc" TEXT;
