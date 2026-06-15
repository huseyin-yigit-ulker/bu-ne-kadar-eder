import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { consume, peek, getClientIp } from "@/lib/ratelimit";
import { SYSTEM_PROMPT, userInstruction, RESULT_SCHEMA } from "@/lib/prompt";
import type { AnalysisResult, AnalyzeResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

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

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "Sunucu yapılandırması eksik: GEMINI_API_KEY tanımlı değil." },
      { status: 500 },
    );
  }

  // 2) Girdiyi al
  let body: { imageBase64?: string; mediaType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Geçersiz istek." }, { status: 400 });
  }

  const { imageBase64, mediaType } = body;
  if (!imageBase64 || !mediaType) {
    return NextResponse.json({ ok: false, error: "Fotoğraf bulunamadı." }, { status: 400 });
  }
  if (!ALLOWED.includes(mediaType)) {
    return NextResponse.json(
      { ok: false, error: "Desteklenmeyen dosya türü. JPEG, PNG veya WebP yükleyin." },
      { status: 400 },
    );
  }

  // 3) Gemini vision + structured output çağrısı
  let result: AnalysisResult;
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESULT_SCHEMA,
        maxOutputTokens: 1500,
      },
    });

    const response = await model.generateContent([
      { inlineData: { data: imageBase64, mimeType: mediaType } },
      { text: userInstruction() },
    ]);

    const text = response.response.text();
    if (!text) throw new Error("Modelden yanıt alınamadı.");
    result = JSON.parse(text) as AnalysisResult;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analiz sırasında bir hata oluştu.";
    console.error("[analyze] hata:", message);
    return NextResponse.json(
      { ok: false, error: "Analiz başarısız oldu. Lütfen tekrar deneyin." },
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
