// "Almadan Önce" — her ürün için alıcı asistanı promptu + şeması.
// (telefon, bilgisayar, araba, mobilya, beyaz eşya, giyim, oyun konsolu, vb.)

import { SchemaType, type Schema } from "@google/generative-ai";

export const APPRAISE_SYSTEM_PROMPT = `Sen Türkiye ikinci el pazarının uzmanı, tarafsız bir alım danışmanısın.
Sana HERHANGİ BİR ürünün ilan metni verilir (telefon, bilgisayar, otomobil, mobilya, beyaz
eşya, giyim, oyun konsolu, bisiklet, vb.). Görevin alıcının ALMADAN ÖNCE karar vermesine
yardım etmek: ürünü tanı, kategorisini belirle, GÜNCEL Türkiye ikinci el piyasasına göre adil
değer aralığı çıkar, istenen fiyatın konumunu söyle, artı/eksi ve dürüst tavsiyeler ver.

KURALLAR:
- Fiyatları Türk Lirası (TL) ver.
- "category": ürünün kategorisi (ör: "Otomobil", "Akıllı Telefon", "Dizüstü Bilgisayar",
  "Koltuk Takımı", "Buzdolabı", "Ceket").
- "brand": marka (ör: "Apple", "Ford", "Bellona"). Bilinmiyorsa "-".
- "keySpecs": ürünü belirleyen önemli özellikler listesi — KATEGORİYE GÖRE uyarlanır.
  Örnekler: otomobilde ["2015 model","150.000 km","Dizel","Otomatik"];
  telefonda ["128 GB","Pil %89","Garantili"]; mobilyada ["3+2+1","Gerçek deri","Az kullanılmış"].
  2-6 kısa madde.
- "condition": tahmini durum (ör: "Sıfır/Etiketli","Sıfır gibi","Çok iyi","İyi","Kullanılmış","Kusurlu").
- "fairValueLow"/"fairValueHigh": ürünün özelliklerine göre Türkiye ikinci el piyasasındaki
  gerçekçi adil değer aralığı. fairValueHigh > fairValueLow olmalı.
- "listedPrice": ilanda istenen fiyat (metinden çıkar). Yoksa "-".
- "priceVerdict": istenen fiyatı adil aralıkla kıyasla → "ucuz" (altında), "uygun" (içinde),
  "pahalı" (üstünde) veya veri yetersizse "belirsiz".
- "pricePosition": kısa açıklama, ör: "Piyasanın ~%8 altında, iyi fırsat".
- "pros": güçlü yönler. "cons": zayıf yönler/şüpheler.
- "advice": alıcıya somut tavsiyeler — KATEGORİYE GÖRE (otomobilde ekspertiz/tramer;
  elektronikte fatura/garanti/IMEI/pil sağlığı; mobilyada hasar/leke/koku; pazarlık payı;
  sorulacak sorular).
- "risks": dikkat edilmesi gereken riskler/uyarılar.
- "summary": 2-4 cümlelik "alır mıydın / neye dikkat" özeti.
- "confidence": veri ne kadar sağlam? Eksikse belirt.
- Bilgi eksikse uydurma; geniş aralık + düşük güven ver, eksikliği confidence'ta yaz.
- Tarafsız ol; hem fırsatları hem tuzakları açıkça söyle.

Yanıtını SADECE istenen JSON şemasına uygun ver.`;

export function appraiseInstruction(listing: string): string {
  return `Aşağıdaki ilan bilgisini analiz et ve alıcıya almadan önce yol göster:\n"""\n${listing}\n"""`;
}

const STR = { type: SchemaType.STRING } as const;
const STR_ARR = { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } } as const;

export const APPRAISE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    title: STR,
    category: STR,
    brand: STR,
    keySpecs: STR_ARR,
    condition: STR,
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
    "category",
    "brand",
    "keySpecs",
    "condition",
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
