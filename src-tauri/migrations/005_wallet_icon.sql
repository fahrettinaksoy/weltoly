-- Cüzdanlara seçilebilir ikon.
--
-- Önceden ikon türden TÜRETİLİYORDU (walletTypeIcon[type]) — kayıtlı bir alan yoktu,
-- dolayısıyla aynı türdeki tüm cüzdanlar aynı ikonu taşıyordu.
--
-- null/'' = "seçilmedi" → uygulama türün varsayılan ikonuna düşer (walletMeta.walletIcon).
-- Bu sayede 005 öncesi cüzdanlar hiçbir şey yapmadan çalışmaya devam eder.
ALTER TABLE wallets ADD COLUMN icon TEXT;
