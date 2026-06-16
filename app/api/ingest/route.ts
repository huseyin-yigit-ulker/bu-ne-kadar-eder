import { NextResponse } from "next/server";
import { fetchImageAsBase64, buildAsDescription, type ScrapedListing } from "@/lib/scrape";
import type { ScanItem } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

// Tarayıcı eklentisinin DOM'dan çektiği veriyi geçici saklayan basit kova.
// İki tür: "listing" (tek ilan → analiz) ve "scan" (arama sayfasındaki ilan listesi → piyasa).
// Eklenti POST eder → id döner → uygulama ?ext=<id> ile açılır ve GET ile okur.
//
// ÜRETİM NOTU: bellek-içi (tek instance). Vercel'de Redis/Upstash'a taşınmalı.
interface Stored {
  kind: "listing" | "scan";
  listing?: ScrapedListing;
  items?: ScanItem[];
  expires: number;
}
const store = new Map<string, Stored>();
const TTL_MS = 10 * 60 * 1000;

function purge() {
  const now = Date.now();
  const dead: string[] = [];
  store.forEach((v, k) => {
    if (v.expires < now) dead.push(k);
  });
  dead.forEach((k) => store.delete(k));
}

function randomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function POST(req: Request): Promise<NextResponse> {
  purge();

  let body: {
    kind?: string;
    items?: { title?: string; price?: string; url?: string }[];
    title?: string;
    description?: string;
    price?: string;
    imageUrls?: string[];
    sourceUrl?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Geçersiz istek." }, { status: 400 });
  }

  // --- SCAN: arama sayfasından toplanan ilan listesi ---
  if (body.kind === "scan") {
    const items: ScanItem[] = (Array.isArray(body.items) ? body.items : [])
      .filter((it) => it && typeof it.url === "string" && typeof it.title === "string")
      .slice(0, 30)
      .map((it) => ({
        title: String(it!.title).slice(0, 140),
        price: String(it!.price ?? "").slice(0, 60),
        url: String(it!.url),
      }));
    if (items.length === 0) {
      return NextResponse.json({ ok: false, error: "Sayfada ilan bulunamadı." }, { status: 422 });
    }
    const id = randomId();
    store.set(id, { kind: "scan", items, expires: Date.now() + TTL_MS });
    return NextResponse.json({ ok: true, id, kind: "scan", count: items.length });
  }

  // --- LISTING: tek ilan ---
  const title = (body.title ?? "").toString().slice(0, 300);
  const description = (body.description ?? "").toString().slice(0, 3000);
  const price = (body.price ?? "").toString().slice(0, 60);
  if (!title && !description) {
    return NextResponse.json({ ok: false, error: "Sayfadan ürün bilgisi okunamadı." }, { status: 422 });
  }

  let imageBase64: string | undefined;
  let mediaType: string | undefined;
  const urls = Array.isArray(body.imageUrls) ? body.imageUrls.slice(0, 5) : [];
  for (const u of urls) {
    const img = await fetchImageAsBase64(String(u));
    if (img) {
      imageBase64 = img.base64;
      mediaType = img.mediaType;
      break;
    }
  }

  let source = "";
  try {
    source = body.sourceUrl ? new URL(body.sourceUrl).hostname : "";
  } catch {
    /* yoksay */
  }

  const listing: ScrapedListing = {
    title,
    description,
    price,
    imageBase64,
    mediaType,
    asDescription: buildAsDescription({ title, description, price, source }),
  };

  const id = randomId();
  store.set(id, { kind: "listing", listing, expires: Date.now() + TTL_MS });
  return NextResponse.json({ ok: true, id, kind: "listing" });
}

// Uygulama → veriyi oku (tek kullanımlık)
export async function GET(req: Request): Promise<NextResponse> {
  purge();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id gerekli." }, { status: 400 });
  const found = store.get(id);
  if (!found) {
    return NextResponse.json({ ok: false, error: "Veri bulunamadı veya süresi doldu." }, { status: 404 });
  }
  store.delete(id);
  return NextResponse.json({ ok: true, kind: found.kind, listing: found.listing, items: found.items });
}
