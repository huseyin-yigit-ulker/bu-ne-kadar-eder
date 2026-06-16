# Scraper Servisi (crawl4ai)

İlan sayfalarını **gerçek headless tarayıcı** (Playwright/Chromium) ile render edip okur.
Bu sayede Akamai/DataDome gibi JavaScript-challenge'ları çözebilir — düz HTTP `fetch`in
geçemediği Letgo/Sahibinden/Dolap gibi siteler için.

## Kurulum

```bash
cd scraper
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m playwright install chromium
# Chromium sistem kütüphaneleri eksikse (Linux):
#   sudo .venv/bin/python -m playwright install-deps chromium
```

## Çalıştırma

```bash
cd scraper
.venv/bin/uvicorn server:app --host 127.0.0.1 --port 8000
```

Sağlık kontrolü: `curl http://127.0.0.1:8000/health`

Test:
```bash
curl -X POST http://127.0.0.1:8000/scrape \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.letgo.com/item/..."}'
```

## Next.js'e bağlama

`.env.local` içine ekle:
```
CRAWLER_URL=http://127.0.0.1:8000
```

Artık `/api/preview-url` (ve link modu) önce crawl4ai servisini dener; başarısız olursa
doğrudan fetch / opsiyonel unlocker'a düşer.

## Notlar

- İlk çağrı tarayıcı ısınması nedeniyle yavaş olabilir; servis tarayıcıyı açık tutar.
- Bazı siteler residential proxy de ister; crawl4ai tek başına her zaman yetmeyebilir.
- Sadece yerelde / kendi sunucunda çalıştır; herkese açık bir uç haline getirme (SSRF).
