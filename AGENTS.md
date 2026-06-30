<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Aktivite Sayfası (Event Log)

Sistemde gerçekleşen **tüm aksiyonlar** `/activity` sayfasına event log olarak düşmelidir.

- Hasta oluşturma, güncelleme, silme
- Randevu oluşturma, iptal, tamamlama
- Belge yükleme, silme
- Kullanıcı giriş/çıkış
- Rol ve yetki değişiklikleri
- Departman değişiklikleri

Her log kaydı şu alanları içermelidir: `timestamp`, `actor` (işlemi yapan kullanıcı), `action` (ne yapıldı), `entity` (hangi kayıt etkilendi), `metadata` (ek detaylar, isteğe bağlı).

Yeni bir özellik veya API action yazılırken ilgili event'in aktivite log'una yazılması zorunludur — sonradan eklenmez, o feature'ın parçasıdır.
