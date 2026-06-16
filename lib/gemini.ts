// Ortak Gemini analiz katmanı — hem /api/analyze (foto) hem /api/from-url (link) kullanır.

import { GoogleGenerativeAI } from "@google/generative-ai";
import { SYSTEM_PROMPT, userInstruction, RESULT_SCHEMA } from "./prompt";
import { APPRAISE_SYSTEM_PROMPT, appraiseInstruction, APPRAISE_SCHEMA } from "./appraise";
import { MARKET_SYSTEM_PROMPT, marketInstruction, MARKET_SCHEMA } from "./market";
import type { AnalysisResult, ProductAnalysis, MarketAnalysis, ScanItem } from "./types";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export interface ImageInput {
  base64: string;
  mediaType: string;
}

// Geçici hatalar (503/429/overloaded) için kısa, artan beklemeli retry.
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const retryable = /50[23]|high demand|overloaded|429|rate limit/i.test(msg);
      if (!retryable || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw lastErr;
}

/**
 * Ürünü analiz eder. En az bir görsel VEYA dolu bir açıklama gerekir.
 * (Link modunda görsel çekilemezse, çıkarılan başlık/açıklama/fiyat metni yeterlidir.)
 */
export async function analyzeListing(
  images: ImageInput[],
  description: string,
): Promise<AnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("CONFIG_MISSING: GEMINI_API_KEY tanımlı değil.");
  if (images.length === 0 && !description.trim()) {
    throw new Error("Analiz için fotoğraf veya açıklama gerekli.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESULT_SCHEMA,
      maxOutputTokens: 2048,
      // gemini-2.5-flash varsayılan "thinking" yapar; JSON bütçesini yememesi için kapalı.
      thinkingConfig: { thinkingBudget: 0 },
    } as Record<string, unknown>,
  });

  const parts: Array<
    { inlineData: { data: string; mimeType: string } } | { text: string }
  > = images.map((img) => ({
    inlineData: { data: img.base64, mimeType: img.mediaType },
  }));
  parts.push({ text: userInstruction(description) });

  const text = await withRetry(async () => {
    const response = await model.generateContent(parts);
    const t = response.response.text();
    if (!t) throw new Error("Modelden boş yanıt alındı.");
    return t;
  });

  return JSON.parse(text) as AnalysisResult;
}

/** Her ürün için ilan metnini analiz eder (görselsiz) — "Almadan Önce" alıcı asistanı. */
export async function appraiseListing(listing: string): Promise<ProductAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("CONFIG_MISSING: GEMINI_API_KEY tanımlı değil.");
  if (!listing.trim()) throw new Error("Analiz için ilan bilgisi gerekli.");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: APPRAISE_SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: APPRAISE_SCHEMA,
      maxOutputTokens: 2048,
      thinkingConfig: { thinkingBudget: 0 },
    } as Record<string, unknown>,
  });

  const text = await withRetry(async () => {
    const response = await model.generateContent(appraiseInstruction(listing));
    const t = response.response.text();
    if (!t) throw new Error("Modelden boş yanıt alındı.");
    return t;
  });

  return JSON.parse(text) as ProductAnalysis;
}

/** Piyasa taraması — gerçek ilan listesini yorumlar. */
export async function appraiseMarket(items: ScanItem[]): Promise<MarketAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("CONFIG_MISSING: GEMINI_API_KEY tanımlı değil.");
  if (!items.length) throw new Error("Analiz için ilan listesi gerekli.");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: MARKET_SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: MARKET_SCHEMA,
      maxOutputTokens: 2048,
      thinkingConfig: { thinkingBudget: 0 },
    } as Record<string, unknown>,
  });

  const text = await withRetry(async () => {
    const response = await model.generateContent(marketInstruction(items));
    const t = response.response.text();
    if (!t) throw new Error("Modelden boş yanıt alındı.");
    return t;
  });

  return JSON.parse(text) as MarketAnalysis;
}
