// "Almadan Önce" — araç alım asistanı için prompt + şema.

import { SchemaType, type Schema } from "@google/generative-ai";

export const VEHICLE_SYSTEM_PROMPT = `Sen Türkiye ikinci el otomobil piyasasının uzmanı, tarafsız bir alım danışmanısın.
Sana bir ilan metni (ve varsa kullanıcı notu) verilir. Görevin, alıcının ALMADAN ÖNCE
karar vermesine yardım etmek: aracı tanımla, GÜNCEL Türkiye ikinci el piyasasına göre adil
değer aralığı belirle, istenen fiyatın piyasaya göre konumunu söyle ve artı/eksilerle birlikte
samimi, dürüst tavsiyeler ver.

KURALLAR:
- Fiyatları Türk Lirası (TL) ver.
- "fairValueLow"/"fairValueHigh": aracın marka/model/yıl/km/donanım/durumuna göre Türkiye
  ikinci el piyasasındaki gerçekçi adil değer aralığı. fairValueHigh > fairValueLow olmalı.
- "listedPrice": ilanda istenen fiyat (metinden çıkar). Yoksa "-".
- "priceVerdict": istenen fiyatı adil aralıkla kıyasla → "ucuz" (aralığın altında),
  "uygun" (aralık içinde), "pahalı" (aralığın üstünde) veya veri yetersizse "belirsiz".
- "pricePosition": kısa açıklama, ör: "Piyasanın ~%8 altında, iyi fırsat" / "Üst bandın %12 üstünde".
- "pros": aracın/ilanın güçlü yönleri (düşük km, değişensiz, bakımlı, dolu donanım vb.).
- "cons": zayıf yönler/şüpheler (yüksek km, değişen parça, eksik bilgi, yüksek fiyat vb.).
- "advice": alıcıya somut tavsiyeler — pazarlık payı, ekspertiz, sorulacak sorular, kontrol noktaları.
- "risks": dikkat edilmesi gereken riskler/uyarılar (hasar kaydı, masraf, tramer vb.).
- "summary": 2-4 cümlelik, "alır mıydın / neye dikkat" özeti.
- "confidence": veri ne kadar sağlam? Eksik bilgi varsa belirt (ör: "km ve hasar bilgisi yok, tahmin geniş").
- Bilgi eksikse uydurma; tahminini geniş aralıkla ve düşük güvenle ver, eksikliği confidence'ta yaz.
- Tarafsız ol; hem fırsatları hem tuzakları açıkça söyle.

Yanıtını SADECE istenen JSON şemasına uygun ver.`;

export function vehicleInstruction(listing: string): string {
  return `Aşağıdaki ilan bilgisini analiz et ve alıcıya almadan önce yol göster:\n"""\n${listing}\n"""`;
}

const STR = { type: SchemaType.STRING } as const;
const STR_ARR = { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } } as const;

export const VEHICLE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    title: STR,
    make: STR,
    model: STR,
    year: STR,
    km: STR,
    listedPrice: STR,
    fairValueLow: { type: SchemaType.NUMBER },
    fairValueHigh: { type: SchemaType.NUMBER },
    currency: STR,
    priceVerdict: STR,
    pricePosition: STR,
    pros: STR_ARR,
    cons: STR_ARR,
    advice: STR_ARR,
    risks: STR_ARR,
    summary: STR,
    confidence: STR,
  },
  required: [
    "title",
    "make",
    "model",
    "year",
    "km",
    "listedPrice",
    "fairValueLow",
    "fairValueHigh",
    "currency",
    "priceVerdict",
    "pricePosition",
    "pros",
    "cons",
    "advice",
    "risks",
    "summary",
    "confidence",
  ],
};
