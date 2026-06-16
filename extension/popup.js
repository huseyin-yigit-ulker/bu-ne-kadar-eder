// Almadan Önce — tarayıcı eklentisi popup mantığı.
//
// İki mod:
//  1) "Bu İlanı Analiz Et": açık tek ilan sayfasını okur → /api/ingest (kind:listing) → analiz.
//  2) "Benzer İlanları Tara": arama sonuç sayfasındaki TÜM ilan kartlarını okur
//     → /api/ingest (kind:scan) → piyasa taraması (gerçek, linkli ilanlar).
//
// Eklenti senin tarayıcında (residential IP, challenge geçilmiş) çalıştığı için
// bot engellerine takılmadan gerçek veriye ulaşır.

const APP_URL = "http://localhost:3000";

const statusEl = document.getElementById("status");
function setStatus(msg, cls = "") {
  statusEl.textContent = msg;
  statusEl.className = "status " + cls;
}

// --- Tek ilan sayfası scraper (sayfa içinde çalışır) ---
function scrapePage() {
  const meta = (sel) => document.querySelector(sel)?.getAttribute("content")?.trim() || "";
  const title =
    meta('meta[property="og:title"]') ||
    meta('meta[name="twitter:title"]') ||
    document.querySelector("h1")?.textContent?.trim() ||
    document.title || "";
  const description =
    meta('meta[property="og:description"]') ||
    meta('meta[name="description"]') || "";
  let price =
    meta('meta[property="product:price:amount"]') || meta('meta[property="og:price:amount"]') || "";
  const findPrice = (o) => {
    if (!o || typeof o !== "object") return "";
    if (o.price) return String(o.price);
    if (o.offers) return findPrice(o.offers);
    if (Array.isArray(o)) { for (const x of o) { const p = findPrice(x); if (p) return p; } }
    return "";
  };
  if (!price) {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try { const p = findPrice(JSON.parse(s.textContent)); if (p) { price = p; break; } } catch {}
    }
  }
  const imgs = new Set();
  const ogImg = meta('meta[property="og:image"]');
  if (ogImg) imgs.add(ogImg);
  document.querySelectorAll("img").forEach((im) => {
    const w = im.naturalWidth || im.width || 0;
    const src = im.currentSrc || im.src || "";
    if (w >= 300 && src.startsWith("http")) imgs.add(src);
  });
  return { title, description, price, imageUrls: Array.from(imgs).slice(0, 5), sourceUrl: location.href };
}

// --- Arama sayfası harvester (sayfa içinde çalışır) ---
function harvestPage() {
  const isListing = (h) => /\/ilan\/|\/item\/|-iid-\d|\/urun|\/product\//i.test(h);
  const priceRe = /(?:₺\s*)?\d{1,3}(?:[.\s]\d{3})+(?:,\d{2})?\s*(?:tl|₺)/i;
  const out = new Map();
  document.querySelectorAll("a[href]").forEach((a) => {
    const href = a.href || "";
    if (!isListing(href)) return;
    const url = href.split("#")[0].split("?")[0];
    if (out.has(url)) return;
    let title = (a.textContent || "").replace(/\s+/g, " ").trim();
    const img = a.querySelector("img");
    if ((!title || title.length < 6) && img && img.alt) title = img.alt.trim();
    let price = "";
    let el = a;
    for (let i = 0; i < 6 && el; i++) {
      const m = (el.innerText || el.textContent || "").match(priceRe);
      if (m) { price = m[0].replace(/\s+/g, " ").trim(); break; }
      el = el.parentElement;
    }
    title = title.slice(0, 140);
    if (title && title.length >= 6) out.set(url, { title, price, url });
  });
  return Array.from(out.values()).slice(0, 30);
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function send(payload) {
  const res = await fetch(`${APP_URL}/api/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

document.getElementById("go").addEventListener("click", async () => {
  setStatus("Sayfa okunuyor…");
  try {
    const tab = await activeTab();
    if (!tab?.id || !/^https?:/.test(tab.url || "")) return setStatus("Bu sekme bir ilan sayfası değil.", "err");
    const [{ result: data } = {}] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scrapePage });
    if (!data || (!data.title && !data.description)) return setStatus("Ürün bilgisi okunamadı.", "err");
    setStatus("Gönderiliyor…");
    const j = await send({ kind: "listing", ...data });
    if (!j.ok) return setStatus(j.error || "Hata", "err");
    setStatus("Açılıyor…", "ok");
    await chrome.tabs.create({ url: `${APP_URL}/?ext=${encodeURIComponent(j.id)}` });
    window.close();
  } catch (e) {
    setStatus("Hata: " + (e?.message || "bilinmiyor"), "err");
  }
});

document.getElementById("scan").addEventListener("click", async () => {
  setStatus("Sayfadaki ilanlar toplanıyor…");
  try {
    const tab = await activeTab();
    if (!tab?.id || !/^https?:/.test(tab.url || "")) return setStatus("Bu sekme uygun değil.", "err");
    const [{ result: items } = {}] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: harvestPage });
    if (!items || items.length === 0)
      return setStatus("Bu sayfada ilan kartı bulunamadı. Bir arama sonuç sayfasında dene.", "err");
    setStatus(`${items.length} ilan bulundu, gönderiliyor…`);
    const j = await send({ kind: "scan", items });
    if (!j.ok) return setStatus(j.error || "Hata", "err");
    setStatus("Açılıyor…", "ok");
    await chrome.tabs.create({ url: `${APP_URL}/?ext=${encodeURIComponent(j.id)}` });
    window.close();
  } catch (e) {
    setStatus("Hata: " + (e?.message || "bilinmiyor"), "err");
  }
});
