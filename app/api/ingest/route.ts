import { NextResponse } from "next/server";
import { fetchImageAsBase64, buildAsDescription, type ScrapedListing } from "@/lib/scrape";

export const runtime = "nodejs";
export const maxDuration = 30;

// Tarayıcı eklentisinin DOM'dan çektiği veriyi geçici saklayan basit kova.
// Eklenti POST eder → id döner → uygulama ?ext=<id> ile açılır ve GET ile okur.
//
// ÜRETİM NOTU: bellek-içi (tek instance). Vercel'de Redis/Upstash'a taşınmalı.
interface Stored {
  listing: ScrapedListing;
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
  // crypto.randomUUID Node 18+ global
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Eklenti → veriyi yükle
export async function POST(req: Request): Promise<NextResponse> {
  purge();

  let body: {
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

  const title = (body.title ?? "").toString().slice(0, 300);
  const description = (body.description ?? "").toString().slice(0, 3000);
  const price = (body.price ?? "").toString().slice(0, 60);
  if (!title && !description) {
    return NextResponse.json(
      { ok: false, error: "Sayfadan ürün bilgisi okunamadı." },
      { status: 422 },
    );
  }

  // İlk uygun görseli sunucu tarafında indir (eklenti URL listesi gönderir)
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
  store.set(id, { listing, expires: Date.now() + TTL_MS });
  return NextResponse.json({ ok: true, id });
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
  store.delete(id); // tek kullanımlık
  return NextResponse.json({ ok: true, listing: found.listing });
}
