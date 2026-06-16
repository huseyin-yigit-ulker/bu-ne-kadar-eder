// Gerçek benzer ilanları arama API'si üzerinden bulur (tıklanır linkli).
//
// Pazaryerleri ve arama motorları bot erişimini engellediği için (Akamai/DataDome,
// "Access Denied", JS-shell), gerçek ilanlara ulaşmanın güvenilir yolu bir arama API'sidir.
// SEARCH_API_KEY tanımlıysa devreye girer; yoksa boş döner ve AI tahmini emsallere düşülür.
//
// Desteklenen sağlayıcılar (SEARCH_PROVIDER):
//   serper   → https://serper.dev (Google, 2.500 ücretsiz sorgu)
//   brave    → https://brave.com/search/api (aylık 2.000 ücretsiz)
//   serpapi  → https://serpapi.com
//   google   → Google Programmable Search (ayrıca GOOGLE_CSE_CX gerekir)

const KEY = process.env.SEARCH_API_KEY;
const PROVIDER = (process.env.SEARCH_PROVIDER || "serper").toLowerCase();

// Türkiye ikinci el pazaryerleri — sadece bu domainlerdeki sonuçları emsal say.
const MARKET_DOMAINS = [
  "sahibinden.com",
  "letgo.com",
  "dolap.com",
  "arabam.com",
  "gardrops.com",
  "vavacars.com",
  "ikinciyeni.com",
  "dolap.com.tr",
];

const PRICE_RE = /(?:₺\s*)?\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})?\s*(?:tl|₺|lira)/i;

export interface Comparable {
  label: string;
  price: string;
  note: string;
  url?: string;
  source?: string;
}

interface RawResult {
  title: string;
  url: string;
  snippet: string;
}

function host(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export async function searchComparables(query: string, max = 5): Promise<Comparable[]> {
  if (!KEY || !query.trim()) return [];
  try {
    const results = await runSearch(`${query.trim()} ikinci el ilan fiyat`);
    const out: Comparable[] = [];
    const seen = new Set<string>();
    for (const r of results) {
      const h = host(r.url);
      if (!MARKET_DOMAINS.some((d) => h === d || h.endsWith("." + d) || h.endsWith(d))) continue;
      const base = r.url.split("?")[0];
      if (seen.has(base)) continue;
      seen.add(base);
      const price = (r.snippet?.match(PRICE_RE)?.[0] || r.title?.match(PRICE_RE)?.[0] || "").trim();
      out.push({
        label: (r.title || "İlan").slice(0, 90),
        price: price || "Fiyat için tıkla",
        note: (r.snippet || "").replace(/\s+/g, " ").slice(0, 90),
        url: r.url,
        source: h,
      });
      if (out.length >= max) break;
    }
    return out;
  } catch {
    return [];
  }
}

async function runSearch(q: string): Promise<RawResult[]> {
  if (PROVIDER === "serper") {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": KEY as string, "Content-Type": "application/json" },
      body: JSON.stringify({ q, gl: "tr", hl: "tr", num: 20 }),
    });
    const j = await res.json();
    return (j.organic ?? []).map((o: { title: string; link: string; snippet?: string }) => ({
      title: o.title,
      url: o.link,
      snippet: o.snippet ?? "",
    }));
  }
  if (PROVIDER === "brave") {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&country=tr&search_lang=tr&count=20`,
      { headers: { "X-Subscription-Token": KEY as string, Accept: "application/json" } },
    );
    const j = await res.json();
    return (j.web?.results ?? []).map((o: { title: string; url: string; description?: string }) => ({
      title: o.title,
      url: o.url,
      snippet: o.description ?? "",
    }));
  }
  if (PROVIDER === "serpapi") {
    const res = await fetch(
      `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(q)}&gl=tr&hl=tr&num=20&api_key=${KEY}`,
    );
    const j = await res.json();
    return (j.organic_results ?? []).map((o: { title: string; link: string; snippet?: string }) => ({
      title: o.title,
      url: o.link,
      snippet: o.snippet ?? "",
    }));
  }
  if (PROVIDER === "google") {
    const cx = process.env.GOOGLE_CSE_CX;
    const res = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${KEY}&cx=${cx}&q=${encodeURIComponent(q)}&gl=tr&num=10`,
    );
    const j = await res.json();
    return (j.items ?? []).map((o: { title: string; link: string; snippet?: string }) => ({
      title: o.title,
      url: o.link,
      snippet: o.snippet ?? "",
    }));
  }
  return [];
}
