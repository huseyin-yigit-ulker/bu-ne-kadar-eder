// İlan linkinden veri çıkarma.
//
// Yaklaşım: sayfayı tarayıcı benzeri bir User-Agent ile çek, Open Graph / JSON-LD /
// standart meta etiketlerinden başlık, açıklama, fiyat ve ana görseli çıkar.
// SINIR: Sahibinden, Dolap gibi siteler bot erişimini engeller (403) veya içeriği
// JavaScript ile yükler — bu durumda anlamlı veri çıkmaz ve kullanıcı foto yüklemeye yönlendirilir.

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const ALLOWED_IMG = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMG_BYTES = 6 * 1024 * 1024;

// Opsiyonel: bot korumasını (Akamai/DataDome/Cloudflare) geçmek için ticari
// "web unlocker" / scraping servisi. Anahtar tanımlıysa doğrudan fetch başarısız
// olduğunda (challenge sayfası) otomatik devreye girer.
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;
const SCRAPER_PROVIDER = (process.env.SCRAPER_PROVIDER || "scrapingbee").toLowerCase();

function unlockerUrl(target: string): string | null {
  if (!SCRAPER_API_KEY) return null;
  const enc = encodeURIComponent(target);
  switch (SCRAPER_PROVIDER) {
    case "scrapingbee":
      return `https://app.scrapingbee.com/api/v1/?api_key=${SCRAPER_API_KEY}&url=${enc}&render_js=true&premium_proxy=true&country_code=tr`;
    case "scraperapi":
      return `https://api.scraperapi.com/?api_key=${SCRAPER_API_KEY}&url=${enc}&render=true&ultra_premium=true&country_code=tr`;
    case "zenrows":
      return `https://api.zenrows.com/v1/?apikey=${SCRAPER_API_KEY}&url=${enc}&js_render=true&antibot=true&proxy_country=tr`;
    case "scrapingant":
      return `https://api.scrapingant.com/v2/general?url=${enc}&x-api-key=${SCRAPER_API_KEY}&browser=true&proxy_country=tr`;
    case "scrapfly":
      return `https://api.scrapfly.io/scrape?key=${SCRAPER_API_KEY}&url=${enc}&render_js=true&asp=true&country=tr`;
    default:
      return null;
  }
}

// Dönen HTML bir bot-challenge / koruma sayfası mı? (gerçek içerik değil)
function isBotChallenge(html: string): boolean {
  if (/challenge validation|_sec\/cp_challenge|sec-cpt-if|cp_clge_done|distil_r_captcha/i.test(html)) {
    return true;
  }
  // Çok küçük gövde + bilinen koruma imzaları
  if (
    html.length < 2500 &&
    /akamai|_abck|datadome|perimeterx|px-captcha|cf-browser-verification|just a moment/i.test(html)
  ) {
    return true;
  }
  return false;
}

export interface ScrapedListing {
  title: string;
  description: string;
  price: string;
  imageBase64?: string;
  mediaType?: string;
  /** AI'a verilecek birleştirilmiş açıklama metni */
  asDescription: string;
}

// SSRF koruması: özel/yerel adreslere istek atma.
function assertPublicHost(hostname: string) {
  const h = hostname.toLowerCase();
  if (
    h === "localhost" ||
    h === "0.0.0.0" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    h === "[::1]" ||
    h === "::1"
  ) {
    throw new Error("Bu adres desteklenmiyor.");
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ");
}

function metaContent(html: string, key: string): string | undefined {
  // <meta property="og:title" content="..."> veya name=... (sıra fark etmez)
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${key}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1].trim());
  }
  return undefined;
}

function extractTitle(html: string): string {
  return (
    metaContent(html, "og:title") ||
    metaContent(html, "twitter:title") ||
    decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "") ||
    ""
  );
}

function extractDescription(html: string): string {
  return (
    metaContent(html, "og:description") ||
    metaContent(html, "twitter:description") ||
    metaContent(html, "description") ||
    ""
  );
}

function extractPrice(html: string): string {
  const metaPrice =
    metaContent(html, "product:price:amount") ||
    metaContent(html, "og:price:amount") ||
    metaContent(html, "price");
  if (metaPrice) {
    const cur =
      metaContent(html, "product:price:currency") || metaContent(html, "og:price:currency") || "";
    return `${metaPrice} ${cur}`.trim();
  }
  // JSON-LD offers.price
  const ld = html.match(/"price"\s*:\s*"?([0-9][0-9.,]*)"?/i);
  if (ld?.[1]) {
    const cur = html.match(/"priceCurrency"\s*:\s*"([^"]+)"/i)?.[1] ?? "";
    return `${ld[1]} ${cur}`.trim();
  }
  return "";
}

function extractImageUrl(html: string, base: string): string | undefined {
  const raw =
    metaContent(html, "og:image") ||
    metaContent(html, "og:image:secure_url") ||
    metaContent(html, "twitter:image");
  if (!raw) return undefined;
  try {
    return new URL(raw, base).toString();
  } catch {
    return undefined;
  }
}

// Sayfa HTML'ini getirir: önce doğrudan, bot koruması varsa (anahtar tanımlıysa)
// ticari unlocker servisi üzerinden. İçerik yoksa net hata fırlatır.
async function getListingHtml(url: URL): Promise<string> {
  let direct = "";
  try {
    const res = await fetchWithTimeout(
      url.toString(),
      { headers: { "User-Agent": BROWSER_UA, "Accept-Language": "tr,en;q=0.8", Accept: "text/html" } },
      12000,
    );
    if (res.ok) direct = await res.text();
  } catch {
    /* doğrudan erişim başarısız → unlocker'a düş */
  }

  if (direct && !isBotChallenge(direct)) return direct;

  // Bot koruması veya boş yanıt → unlocker servisi varsa onunla dene
  const via = unlockerUrl(url.toString());
  if (via) {
    const res = await fetchWithTimeout(via, { headers: { "User-Agent": BROWSER_UA } }, 45000);
    if (res.ok) {
      const html = await res.text();
      if (html && !isBotChallenge(html)) return html;
    }
    throw new Error(
      "Sayfa bot koruması arkasında ve scraping servisi de geçemedi. Tarayıcı eklentisini kullanın.",
    );
  }

  if (direct) {
    throw new Error(
      "Bu site otomatik erişimi engelliyor (Akamai/DataDome gibi bot koruması). " +
        "Tarayıcı eklentisini kullanın — sayfayı kendi tarayıcınızda okur ve engele takılmaz.",
    );
  }
  throw new Error("Sayfa alınamadı. Tarayıcı eklentisini kullanın veya fotoğraf yükleyin.");
}

export async function fetchListing(rawUrl: string): Promise<ScrapedListing> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("Geçersiz URL. http(s) ile başlayan bir ilan linki yapıştırın.");
  }
  if (!/^https?:$/.test(url.protocol)) throw new Error("Sadece http/https linkleri desteklenir.");
  assertPublicHost(url.hostname);

  const html = await getListingHtml(url);

  const title = extractTitle(html);
  const description = extractDescription(html);
  const price = extractPrice(html);

  if (!title.trim() && !description.trim()) {
    throw new Error(
      "Bu sayfadan ürün bilgisi okunamadı — içerik JavaScript ile yükleniyor veya bot koruması var. " +
        "Tarayıcı eklentisini kullanın (sayfayı kendi tarayıcınızda okur), ya da fotoğraf yükleyin.",
    );
  }

  // Ana görseli çekmeyi dene (zorunlu değil)
  let imageBase64: string | undefined;
  let mediaType: string | undefined;
  const imgUrl = extractImageUrl(html, url.toString());
  if (imgUrl) {
    const img = await fetchImageAsBase64(imgUrl);
    if (img) {
      imageBase64 = img.base64;
      mediaType = img.mediaType;
    }
  }

  return {
    title,
    description,
    price,
    imageBase64,
    mediaType,
    asDescription: buildAsDescription({ title, description, price, source: url.hostname }),
  };
}

/** Bir görsel URL'sini güvenli şekilde indirip base64'e çevirir (boyut/tür limitli). */
export async function fetchImageAsBase64(
  rawUrl: string,
): Promise<{ base64: string; mediaType: string } | null> {
  try {
    const u = new URL(rawUrl);
    if (!/^https?:$/.test(u.protocol)) return null;
    assertPublicHost(u.hostname);
    const res = await fetchWithTimeout(rawUrl, { headers: { "User-Agent": BROWSER_UA } }, 10000);
    const ct = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!res.ok || !ALLOWED_IMG.includes(ct)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_IMG_BYTES) return null;
    return { base64: buf.toString("base64"), mediaType: ct };
  } catch {
    return null;
  }
}

/** AI'a verilecek birleştirilmiş açıklama metnini kurar. */
export function buildAsDescription(p: {
  title?: string;
  description?: string;
  price?: string;
  source?: string;
}): string {
  return [
    p.title ? `İlan başlığı: ${p.title}` : "",
    p.description ? `İlan açıklaması: ${p.description}` : "",
    p.price ? `İlanda belirtilen fiyat: ${p.price}` : "",
    p.source ? `Kaynak: ${p.source}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
