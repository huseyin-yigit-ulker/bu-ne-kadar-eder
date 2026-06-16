// Piyasa taraması (eklentiden gelen gerçek ilan listesi) için prompt + şema.

import { SchemaType, type Schema } from "@google/generative-ai";
import type { ScanItem } from "./types";

export const MARKET_SYSTEM_PROMPT = `Sen Türkiye ikinci el pazarının uzmanı bir alım danışmanısın.
Sana aynı/benzer ürüne ait GERÇEK ilan listesi verilir (başlık + fiyat). Görevin alıcıya bu
piyasayı yorumlamak: ne tür bir ürün, fiyatlar neye göre değişiyor, hangileri fırsat/şüpheli,
alırken nelere dikkat etmeli.

KURALLAR:
- "product": Bu ilanların ne olduğu (ör: "iPhone 13 128GB", "Ford Focus 2015 Dizel").
- "priceSummary": Fiyat dağılımı yorumu (ucuzdan pahalıya neden değişiyor, makul aralık).
- "insights": Fiyatı belirleyen faktörler (km, hafıza, yıl, durum, donanım vb.) — 2-5 madde.
- "advice": Alıcıya somut tavsiyeler — 2-5 madde.
- "watchOut": Aşırı ucuz/şüpheli ilanlar, dikkat edilecek riskler — 1-4 madde.
- Sadece verilen ilanlara dayan; uydurma. Türkçe, net ve dürüst yaz.

Yanıtını SADECE istenen JSON şemasına uygun ver.`;

export function marketInstruction(items: ScanItem[]): string {
  const lines = items
    .map((it, i) => `${i + 1}. ${it.title} — ${it.price || "fiyat yok"}`)
    .join("\n");
  return `Aşağıdaki gerçek ilanları analiz et:\n"""\n${lines}\n"""`;
}

const STR = { type: SchemaType.STRING } as const;
const STR_ARR = { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } } as const;

export const MARKET_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    product: STR,
    priceSummary: STR,
    insights: STR_ARR,
    advice: STR_ARR,
    watchOut: STR_ARR,
  },
  required: ["product", "priceSummary", "insights", "advice", "watchOut"],
};
