# Bu Ne Kadar Eder? — Tarayıcı Eklentisi

İlan sayfalarını (Sahibinden, Dolap, Letgo, Trendyol vb.) **kullanıcının kendi tarayıcısında**
okuyup fiyatlar. Sunucudan çekmek yerine eklenti gerçek, render edilmiş, oturum açık sayfayı
okuduğu için bot engellerine takılmaz.

## Nasıl çalışır?

1. Bir ilan sayfasındayken eklenti simgesine tıkla → **"Bu Sayfayı Fiyatla"**.
2. Eklenti sayfanın DOM'undan başlık / açıklama / fiyat / görselleri okur.
3. Veriyi uygulamaya (`/api/ingest`) yollar, dönen kimlikle uygulamayı `?ext=<id>` ile açar.
4. Uygulama **önizleme** ekranına düşer; onaylayınca yapay zeka fiyatlar ve ilan üretir.

## Kurulum (geliştirme — Chrome/Edge)

1. Uygulamayı çalıştır: `npm run dev` (varsayılan `http://localhost:3000`).
2. Chrome'da `chrome://extensions` aç → sağ üstten **Geliştirici modu**'nu aç.
3. **Paketlenmemiş öğe yükle** → bu `extension/` klasörünü seç.
4. Bir ilan sayfasına git, eklenti simgesine tıkla.

## Yayına alırken

- `popup.js` içindeki `APP_URL`'i kendi domaininle değiştir (ör. `https://bunekadareder.app`).
- `manifest.json` → `host_permissions` listesine aynı domaini ekle
  (ör. `"https://bunekadareder.app/*"`).
- Firefox için manifest küçük uyarlamalarla çalışır (MV3 destekli sürümlerde).

## Notlar

- `activeTab` + `scripting` izinleri yalnızca **sen tıkladığında** aktif sekmeyi okur; arka planda
  gezinmeni izlemez.
- Görseller sunucu tarafında indirilir; bazı CDN'ler engellerse yalnızca metinle fiyatlanır.
- İkon eklemek istersen `manifest.json`'a `action.default_icon` / `icons` alanlarını ekle.
