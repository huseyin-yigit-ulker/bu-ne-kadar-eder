import { NextResponse } from "next/server";
import { consume, peek, getClientIp } from "@/lib/ratelimit";
import { analyzeListing, type ImageInput } from "@/lib/gemini";
import type { AnalysisResult, AnalyzeResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_IMAGES = 5;

export async function POST(req: Request): Promise<NextResponse<AnalyzeResponse>> {
  const ip = getClientIp(req);

  // 1) Limit kontrolü (henüz tüketmeden)
  const status = peek(ip);
  if (!status.allowed) {
    return NextResponse.json(
      { ok: false, error: "Günlük ücretsiz hakkınız doldu.", paywall: true, remaining: 0 },
      { status: 429 },
    );
  }

  // 2) Girdiyi al (çoklu görsel + opsiyonel açıklama; tekli format da desteklenir)
  let body: {
    images?: ImageInput[];
    description?: string;
    imageBase64?: string;
    mediaType?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Geçersiz istek." }, { status: 400 });
  }

  let images: ImageInput[] = Array.isArray(body.images) ? body.images : [];
  if (images.length === 0 && body.imageBase64 && body.mediaType) {
    images = [{ base64: body.imageBase64, mediaType: body.mediaType }];
  }

  const description = typeof body.description === "string" ? body.description.slice(0, 4000) : "";

  // En az bir fotoğraf VEYA açıklama gerekir (link modu görselsiz metin gönderebilir)
  if (images.length === 0 && !description.trim()) {
    return NextResponse.json({ ok: false, error: "Fotoğraf veya açıklama gerekli." }, { status: 400 });
  }
  if (images.length > MAX_IMAGES) {
    return NextResponse.json(
      { ok: false, error: `En fazla ${MAX_IMAGES} fotoğraf yükleyebilirsiniz.` },
      { status: 400 },
    );
  }
  for (const img of images) {
    if (!img?.base64 || !img?.mediaType || !ALLOWED.includes(img.mediaType)) {
      return NextResponse.json(
        { ok: false, error: "Desteklenmeyen veya geçersiz fotoğraf. JPEG, PNG veya WebP yükleyin." },
        { status: 400 },
      );
    }
  }

  // 3) Analiz
  let result: AnalysisResult;
  try {
    result = await analyzeListing(images, description);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analiz sırasında bir hata oluştu.";
    console.error("[analyze] hata:", message);
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

  // 4) Başarılı — hakkı şimdi tüket
  const after = consume(ip);
  return NextResponse.json({ ok: true, result, remaining: after.remaining });
}

// Kalan hak sorgusu (arayüzde göstermek için)
export async function GET(req: Request): Promise<NextResponse> {
  const ip = getClientIp(req);
  const status = peek(ip);
  return NextResponse.json({ remaining: status.remaining, limit: status.limit });
}
