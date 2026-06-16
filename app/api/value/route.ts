import { NextResponse } from "next/server";
import { consume, peek, getClientIp } from "@/lib/ratelimit";
import { appraiseListing } from "@/lib/gemini";
import { fetchListing } from "@/lib/scrape";
import type { ProductAnalysis, AppraiseResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 90;

// "Almadan Önce" — ilan linki (veya elle yapıştırılan detay) → alıcı analizi (her ürün).
export async function POST(req: Request): Promise<NextResponse<AppraiseResponse>> {
  const ip = getClientIp(req);

  const status = peek(ip);
  if (!status.allowed) {
    return NextResponse.json(
      { ok: false, error: "Günlük ücretsiz hakkınız doldu.", paywall: true, remaining: 0 },
      { status: 429 },
    );
  }

  let body: { url?: string; details?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Geçersiz istek." }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  const details = typeof body.details === "string" ? body.details.slice(0, 4000).trim() : "";

  if (!url && !details) {
    return NextResponse.json({ ok: false, error: "İlan linki veya ilan detayı gerekli." }, { status: 400 });
  }

  // 1) Veriyi topla: link varsa çek (crawl4ai/unlocker), yoksa/eklenemezse elle detay
  const parts: string[] = [];
  let source: AppraiseResponse["source"];

  if (url) {
    try {
      const listing = await fetchListing(url);
      parts.push(listing.asDescription);
      source = {
        title: listing.title || "",
        price: listing.price || "",
        from: safeHost(url),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Link okunamadı.";
      // Link çekilemedi ama kullanıcı detay yapıştırmadıysa → detay iste
      if (!details) {
        return NextResponse.json(
          {
            ok: false,
            needsDetails: true,
            error:
              message +
              " İlan sayfasındaki bilgileri (marka, model, yıl, km, fiyat, açıklama) kopyalayıp aşağıya yapıştırın.",
          },
          { status: 422 },
        );
      }
      // detay var → onunla devam
    }
  }

  if (details) parts.push(`Kullanıcının verdiği ilan detayı:\n${details}`);

  const listingText = parts.filter(Boolean).join("\n\n");
  if (!listingText.trim()) {
    return NextResponse.json(
      { ok: false, needsDetails: true, error: "İlan bilgisi okunamadı. Detayları elle yapıştırın." },
      { status: 422 },
    );
  }

  // 2) Analiz
  let result: ProductAnalysis;
  try {
    result = await appraiseListing(listingText);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analiz hatası.";
    console.error("[value] hata:", message);
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
        error: busy
          ? "Yapay zeka şu an yoğun. Birkaç saniye sonra tekrar deneyin."
          : "Analiz başarısız oldu. Lütfen tekrar deneyin.",
      },
      { status: 502 },
    );
  }

  const after = consume(ip);
  return NextResponse.json({ ok: true, result, source, remaining: after.remaining });
}

function safeHost(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  const ip = getClientIp(req);
  const status = peek(ip);
  return NextResponse.json({ remaining: status.remaining, limit: status.limit });
}
