import { NextResponse } from "next/server";
import { consume, peek, getClientIp } from "@/lib/ratelimit";
import { appraiseMarket } from "@/lib/gemini";
import type { MarketAnalysis, MarketResponse, ScanItem } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// Eklentinin topladığı gerçek ilan listesi → fiyat istatistiği + AI piyasa yorumu.
export async function POST(req: Request): Promise<NextResponse<MarketResponse>> {
  const ip = getClientIp(req);
  const status = peek(ip);
  if (!status.allowed) {
    return NextResponse.json(
      { ok: false, error: "Günlük ücretsiz hakkınız doldu.", paywall: true, remaining: 0 },
      { status: 429 },
    );
  }

  let body: { items?: ScanItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Geçersiz istek." }, { status: 400 });
  }

  const raw = Array.isArray(body.items) ? body.items : [];
  // Temizle + fiyatı sayısala çevir
  const items: ScanItem[] = raw
    .filter((it) => it && typeof it.url === "string" && typeof it.title === "string")
    .slice(0, 30)
    .map((it) => ({
      title: String(it.title).slice(0, 140),
      price: String(it.price ?? ""),
      url: String(it.url),
      source: safeHost(it.url),
      priceValue: parsePrice(String(it.price ?? "")),
    }));

  if (items.length === 0) {
    return NextResponse.json({ ok: false, error: "İlan bulunamadı." }, { status: 400 });
  }

  const values = items
    .map((i) => i.priceValue)
    .filter((v): v is number => typeof v === "number" && v > 0)
    .sort((a, b) => a - b);
  const stats = values.length
    ? {
        count: values.length,
        min: values[0],
        median: values[Math.floor(values.length / 2)],
        max: values[values.length - 1],
        currency: "TL",
      }
    : { count: 0, min: 0, median: 0, max: 0, currency: "TL" };

  let analysis: MarketAnalysis;
  try {
    analysis = await appraiseMarket(items);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analiz hatası.";
    console.error("[market] hata:", message);
    if (message.startsWith("CONFIG_MISSING")) {
      return NextResponse.json(
        { ok: false, error: "Sunucu yapılandırması eksik: GEMINI_API_KEY tanımlı değil." },
        { status: 500 },
      );
    }
    const busy = /50[23]|high demand|overloaded|429/i.test(message);
    return NextResponse.json(
      {
        ok: false,
        error: busy ? "Yapay zeka şu an yoğun. Tekrar deneyin." : "Analiz başarısız oldu.",
      },
      { status: 502 },
    );
  }

  const after = consume(ip);
  return NextResponse.json({ ok: true, items, stats, analysis, remaining: after.remaining });
}

// "385.000 TL" → 385000 ; "1.234,50" → 1234.5
function parsePrice(s: string): number | undefined {
  const m = s.match(/\d[\d.\s]*(?:,\d{1,2})?/);
  if (!m) return undefined;
  const cleaned = m[0].replace(/[.\s]/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function safeHost(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
