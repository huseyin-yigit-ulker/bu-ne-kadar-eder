// Bu Ne Kadar Eder? — tarayıcı eklentisi popup mantığı.
//
// Akış: aktif sekmedeki ilan sayfasının DOM'unu oku (gerçek tarayıcıda, oturum açık —
// bot engeline takılmaz) → veriyi uygulamanın /api/ingest'ine yolla → uygulamayı
// ?ext=<id> ile aç → uygulama önizleme ekranına düşer, kullanıcı onaylayıp fiyatlar.

// Uygulamanın adresi. Yayına alınca buraya kendi domainini yaz (ve manifest
// host_permissions'a ekle).
const APP_URL = "http://localhost:3000";

const btn = document.getElementById("go");
const statusEl = document.getElementById("status");

function setStatus(msg, cls = "") {
  statusEl.textContent = msg;
  statusEl.className = "status " + cls;
}

// Sayfa içinde çalışacak scraper (executeScript ile enjekte edilir).
function scrapePage() {
  const meta = (sel) => document.querySelector(sel)?.getAttribute("content")?.trim() || "";

  const title =
    meta('meta[property="og:title"]') ||
    meta('meta[name="twitter:title"]') ||
    document.querySelector("h1")?.textContent?.trim() ||
    document.title ||
    "";

  const description =
    meta('meta[property="og:description"]') ||
    meta('meta[name="twitter:description"]') ||
    meta('meta[name="description"]') ||
    "";

  // Fiyat: meta → JSON-LD → sayfadaki para ipucu
  let price =
    meta('meta[property="product:price:amount"]') || meta('meta[property="og:price:amount"]') || "";

  const findPrice = (obj) => {
    if (!obj || typeof obj !== "object") return "";
    if (obj.price) return String(obj.price);
    if (obj.offers) return findPrice(obj.offers);
    if (Array.isArray(obj)) {
      for (const x of obj) {
        const p = findPrice(x);
        if (p) return p;
      }
    }
    return "";
  };
  if (!price) {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const p = findPrice(JSON.parse(s.textContent));
        if (p) {
          price = p;
          break;
        }
      } catch {
        /* yoksay */
      }
    }
  }

  // Görseller: og:image + sayfadaki büyük görseller
  const imgs = new Set();
  const ogImg = meta('meta[property="og:image"]') || meta('meta[property="og:image:secure_url"]');
  if (ogImg) imgs.add(ogImg);
  document.querySelectorAll("img").forEach((im) => {
    const w = im.naturalWidth || im.width || 0;
    const src = im.currentSrc || im.src || "";
    if (w >= 300 && src.startsWith("http")) imgs.add(src);
  });

  return {
    title,
    description,
    price,
    imageUrls: Array.from(imgs).slice(0, 5),
    sourceUrl: location.href,
  };
}

btn.addEventListener("click", async () => {
  btn.disabled = true;
  setStatus("Sayfa okunuyor…");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/.test(tab.url || "")) {
      setStatus("Bu sekme bir ilan sayfası değil.", "err");
      btn.disabled = false;
      return;
    }

    const [{ result: data } = {}] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapePage,
    });

    if (!data || (!data.title && !data.description)) {
      setStatus("Sayfadan ürün bilgisi okunamadı.", "err");
      btn.disabled = false;
      return;
    }

    setStatus("Veri gönderiliyor…");
    const res = await fetch(`${APP_URL}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.ok) {
      setStatus(json.error || "Gönderim başarısız.", "err");
      btn.disabled = false;
      return;
    }

    setStatus("Açılıyor…", "ok");
    await chrome.tabs.create({ url: `${APP_URL}/?ext=${encodeURIComponent(json.id)}` });
    window.close();
  } catch (e) {
    setStatus("Hata: " + (e?.message || "bilinmiyor"), "err");
    btn.disabled = false;
  }
});
