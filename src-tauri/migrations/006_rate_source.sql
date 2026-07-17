-- Kur kaynağı seçimi + kurun KENDİ tarihi.
--
-- 1) user_settings.rateSource — kullanıcının seçtiği FİAT kaynağı.
--    null = 006 öncesi satır → uygulama varsayılana ('frankfurter') düşer.
--    Neden user_settings: baseCurrency'nin doğal komşusu (ikisi de kur alt
--    sistemini besler) ve yedeğe girer (BACKUP_TABLES user_settings'i kapsar).
--    Tema/biçim ayarları localStorage'da; onlar cihaza özgü, bu değil.
--
-- 2) rates.rateDate — KAYNAĞIN kendi kur tarihi (yyyy-MM-dd).
--    Mevcut `date`/`id` BİZİM çekme günümüz. İkisi AYNI DEĞİL: ECB ve TCMB iş
--    günü sonunda yayımlar, hafta sonu/tatil güncellemez. 17 Temmuz'da çekilen
--    kur 16 Temmuz tarihli olabilir. "Kurlar güncel mi" sorusu ancak bu alanla
--    dürüstçe yanıtlanır; `updatedAt` yalnız "biz ne zaman çektik"i söyler.
--    null = kaynak tarih vermiyor ya da 006 öncesi satır.

ALTER TABLE user_settings ADD COLUMN rateSource TEXT;
ALTER TABLE rates ADD COLUMN rateDate TEXT;
