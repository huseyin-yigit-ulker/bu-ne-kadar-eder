# Bu Ne Kadar Eder? 🔍

İnsanların üşengeçliğini ortadan kaldıran "ağrı kesici" bir mikro-SaaS: eşyanın
fotoğrafını çek → yapay zeka saniyeler içinde **fiyatını belirlesin** ve
**kopyalanmaya hazır ilan metnini** yazsın.

> Telefon kamerasıyla çek → AI piyasayı tarasın → fiyat skalası + ilan metni →
> tek tıkla kopyala, sat.

## Özellikler (MVP)

- 📷 Kamera / galeri ile fotoğraf yükleme (tarayıcıda otomatik küçültme)
- 🤖 Google Gemini (vision) ile ürün tanıma + Türkiye ikinci el piyasasına göre fiyatlama
- 💰 Çift bantlı fiyat skalası (Hızlı Satış / Optimal)
- 📝 Emojili, güven veren, kopyalanmaya hazır ilan metni
- 🔁 Kopyalanan ilana otomatik watermark (viral döngü)
- 🚪 IP başına günlük ücretsiz limit + paywall iskeleti
- ⚡ Elektronik cihazlarda affiliate "Hemen Sat" butonu (gizli gelir kanalı)

## Teknik mimari

| Katman | Teknoloji |
|--------|-----------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS |
| AI | Google Gemini API — vision + structured output (`gemini-2.5-flash`) |
| Limitleme | Bellek-içi IP bazlı (MVP) — üretimde Supabase/Upstash'a taşınmalı |
| Deploy | Vercel (önerilen) |

## Kurulum

```bash
# 1. Bağımlılıkları yükle
npm install

# 2. Ortam değişkenlerini ayarla
cp .env.example .env.local
# .env.local içine GEMINI_API_KEY anahtarını gir (https://aistudio.google.com/apikey)

# 3. Geliştirme sunucusunu başlat
npm run dev
# http://localhost:3000
```

> Node.js 18.18+ gerekir.

## Ortam değişkenleri

| Değişken | Açıklama | Varsayılan |
|----------|----------|------------|
| `GEMINI_API_KEY` | Google Gemini API anahtarı (zorunlu) | — |
| `GEMINI_MODEL` | Kullanılacak model | `gemini-2.5-flash` |
| `FREE_DAILY_LIMIT` | IP başına günlük ücretsiz tarama | `2` |

## Proje yapısı

```
app/
  page.tsx              # Tüm kullanıcı akışı (upload → loading → result → paywall)
  layout.tsx
  globals.css
  api/analyze/route.ts  # Vision + fiyatlama endpoint'i (rate-limit + Anthropic)
lib/
  prompt.ts             # Sistem mesajı + JSON şeması (prompt mühendisliği)
  ratelimit.ts          # IP bazlı günlük limit (MVP, bellek-içi)
  types.ts              # Paylaşılan tipler
```

## Yol haritası

- [ ] Supabase ile kalıcı limit + kullanıcı kredileri
- [ ] Iyzico / Stripe ile ödeme (kredi paketleri & Pro abonelik)
- [ ] B2B Pro plan: toplu yükleme, marka diline göre ton, ilan geçmişi
- [ ] Gerçek affiliate entegrasyonları (EasyCep / GetMobil vb.)
- [ ] Watermark'lı paylaşım görseli (viral döngü)

## Gelir modeli

- **B2C:** Freemium (günde 2 hak) + mikro kredi paketleri
- **B2B:** Aylık Pro abonelik (butikler, spotçular, al-satçılar)
- **Affiliate:** Elektronik cihaz yönlendirmelerinden komisyon

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
