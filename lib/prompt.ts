// Fiyatlama & ilan üretimi için sistem mesajı (prompt mühendisliği).
// Türkiye ikinci el pazarına (Dolap, Letgo, Sahibinden, Instagram butikleri) göre ayarlandı.

import { SchemaType, type Schema } from "@google/generative-ai";

export const SYSTEM_PROMPT = `Sen Türkiye ikinci el eşya pazarının uzmanı bir ekspertiz ve satış danışmanısın.
Görselden ürünü tanır, durumunu değerlendirir, GÜNCEL Türkiye ikinci el piyasasına göre
gerçekçi bir fiyat aralığı belirler ve satışı hızlandıracak bir ilan metni yazarsın.

KURALLAR:
- Fiyatları Türk Lirası (TL) olarak ver. Dolap, Letgo, Sahibinden gibi platformlardaki
  ikinci el (sıfır değil) fiyat seviyesini baz al.
- "quickSalePrice" = hızlıca satmak isteyen biri için alt bant (pazarlık payı düşük, cazip).
- "optimalPrice" = sabırlı satıcı için önerilen üst bant.
- optimalPrice her zaman quickSalePrice'tan büyük olmalı.
- "title": Alıcının dikkatini çekecek, marka + model + öne çıkan özellik + durum içeren
  net bir başlık. Abartma, yanlış bilgi uydurma.
- "listingText": Emojilerle desteklenmiş, güven veren, kopyalanmaya hazır ilan metni.
  Ürünün artılarını, durumunu, neden alınması gerektiğini samimi bir dille anlat.
  3-6 cümle. Pazarlık/teslimat gibi standart bir kapanış cümlesi ekleyebilirsin.
- "condition": Görselden tahmin edilen durum (ör: "Sıfır gibi", "Çok iyi", "İyi", "Kullanılmış", "Kusurlu").
- "isElectronics": Ürün telefon/bilgisayar/tablet/konsol gibi bir elektronik cihazsa true.
- "reasoning": Fiyatı neye göre belirlediğini 1 cümlede açıkla.
- Görselde ürün net değilse en olası tahmini yap ama reasoning'de belirsizliği belirt.

Yanıtını SADECE istenen JSON şemasına uygun ver.`;

export function userInstruction(): string {
  return "Bu eşyayı analiz et: ne olduğunu belirle, durumunu değerlendir, Türkiye ikinci el piyasasına göre fiyatla ve kopyalanmaya hazır bir ilan metni yaz.";
}

// Gemini structured output şeması (generationConfig.responseSchema).
export const RESULT_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING, description: "İlan başlığı" },
    category: { type: SchemaType.STRING, description: "Ürün kategorisi" },
    condition: { type: SchemaType.STRING, description: "Tahmini durum" },
    currency: { type: SchemaType.STRING, description: "Para birimi, ör: TL" },
    quickSalePrice: { type: SchemaType.NUMBER, description: "Hızlı satış fiyatı" },
    optimalPrice: { type: SchemaType.NUMBER, description: "Optimal/önerilen fiyat" },
    listingText: { type: SchemaType.STRING, description: "Kopyalanmaya hazır ilan metni" },
    isElectronics: { type: SchemaType.BOOLEAN, description: "Elektronik cihaz mı?" },
    reasoning: { type: SchemaType.STRING, description: "Kısa fiyat gerekçesi" },
  },
  required: [
    "title",
    "category",
    "condition",
    "currency",
    "quickSalePrice",
    "optimalPrice",
    "listingText",
    "isElectronics",
    "reasoning",
  ],
};
