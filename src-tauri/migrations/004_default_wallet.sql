-- Varsayılan cüzdan: yeni işlem formu açılırken önceden seçili gelen cüzdan.
--
-- Neden wallets tablosunda bir isDefault sütunu DEĞİL:
-- "varsayılan" her cüzdanın bir özelliği değil, cüzdanlar arasından TEK bir seçim.
-- Satır başına boolean tutmak iki cüzdanın da varsayılan olmasına izin verirdi
-- (geçersiz durum) ve her yazımda tekliğin elle korunması gerekirdi. Tek işaretçi
-- tutunca bu durum yapısal olarak imkânsız.
--
-- user_settings tek satırlıdır ('local'), baseCurrency/locale ile aynı yerde durur.
-- Cüzdan silinince işaretçi temizlenir (wallets/store.ts deleteWallet) — FK yok,
-- bu yüzden dangling referansı uygulama tarafı temizler.

ALTER TABLE user_settings ADD COLUMN defaultWalletId TEXT;
