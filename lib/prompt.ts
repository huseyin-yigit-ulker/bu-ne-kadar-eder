// Fiyatlama & ilan üretimi için sistem mesajı (prompt mühendisliği).
// Türkiye ikinci el pazarına — özellikle Dolap/Gardrops gibi GİYİM pazaryerlerine — göre ayarlandı.

import { SchemaType, type Schema } from "@google/generative-ai";

export const SYSTEM_PROMPT = `Sen Türkiye ikinci el pazarının uzmanı bir ekspertiz ve satış danışmanısın.
Özellikle Dolap, Gardrops, Vinted gibi ikinci el GİYİM/MODA pazaryerlerini çok iyi bilirsin.
Görselden ürünü tanır, durumunu değerlendirir, güncel Türkiye ikinci el piyasasına göre
gerçekçi bir fiyat aralığı belirler ve satışı hızlandıracak bir ilan metni yazarsın.

GENEL KURALLAR:
- Fiyatları Türk Lirası (TL) olarak ver. Dolap, Gardrops, Letgo, Sahibinden gibi
  platformlardaki ikinci el (sıfır değil) fiyat seviyesini baz al.
- "quickSalePrice" = hızlıca satmak isteyen biri için alt bant (cazip, pazarlık payı düşük).
- "optimalPrice" = sabırlı satıcı için önerilen üst bant. Her zaman quickSalePrice'tan büyük.
- "condition": Görselden tahmin edilen durum (ör: "Sıfır/Etiketli", "Sıfır gibi", "Çok iyi", "İyi", "Kullanılmış", "Kusurlu").
- "isElectronics": Ürün telefon/bilgisayar/tablet/konsol gibi bir elektronik cihazsa true.
- "reasoning": Fiyatı neye göre belirlediğini 1 cümlede açıkla.
- Görsel net değilse en olası tahmini yap ama reasoning'de belirsizliği belirt.
- Birden fazla fotoğraf verilirse hepsi AYNI ürünün farklı açıları/detaylarıdır; hepsini
  birlikte değerlendir (kusur, etiket, marka detayı için tüm kareler önemli).
- Kullanıcı bir AÇIKLAMA notu eklediyse (marka, model, yaş, kusur, orijinal kutu, kullanım
  süresi vb.) bunu fiyatlamada ÖNCELİKLE dikkate al; görselle çelişmiyorsa kullanıcının
  verdiği bilgiyi doğru kabul et ve fiyatı buna göre netleştir.

GİYİM/MODA ÜRÜNLERİ İÇİN (kıyafet, ayakkabı, çanta, aksesuar):
- "isClothing": true yap.
- "brand": Görünür logo/etiket/dikiş ipuçlarından markayı tahmin et (ör: "Zara", "Mango", "Nike").
  Emin değilsen "Bilinmiyor" yaz, uydurma.
- "size": Etiketten/oranlardan bedeni tahmin et (ör: "M", "38", "40", "EU 42"). Yoksa "-".
- "color": Ana rengi yaz (ör: "Bej", "Siyah", "Lacivert").
- "gender": Departman — "Kadın", "Erkek", "Unisex" veya "Çocuk".
- "clothingCategory": Dolap tarzı kategori yolu (ör: "Kadın > Üst Giyim > Triko",
  "Erkek > Ayakkabı > Sneaker", "Kadın > Çanta").
- "material": Kumaş/materyal tahmini (ör: "Pamuk", "Deri", "Triko"). Bilinmiyorsa "-".
- "title": Marka + ürün tipi + öne çıkan özellik + renk + beden içeren net başlık
  (ör: "Zara Oversize Triko Kazak, Bej, M Beden").
- "listingText": Dolap diline uygun, emojili, güven veren, kopyalanmaya hazır metin.
  Markayı, bedeni, durumu, kumaşı, neden alınması gerektiğini samimi anlat (3-6 cümle).
  Metnin SONUNA ilgili hashtag'leri ekle (ör: #zara #triko #kadıngiyim #dolap #2.el).

GİYİM DIŞI ÜRÜNLER İÇİN:
- "isClothing": false yap.
- brand/size/color/gender/clothingCategory/material alanlarına "-" yaz (uygulanamaz).
- "title" ve "listingText"i ürüne uygun, genel ikinci el diliyle yaz.

Yanıtını SADECE istenen JSON şemasına uygun ver.`;

export function userInstruction(description?: string): string {
  const base =
    "Bu eşyayı analiz et: ne olduğunu belirle (giyim ürünü ise marka/beden/renk/kategori dahil), durumunu değerlendir, Türkiye ikinci el piyasasına göre fiyatla ve kopyalanmaya hazır bir ilan metni yaz.";
  const note = description?.trim();
  if (!note) return base;
  return `${base}\n\nKullanıcının eklediği açıklama/notlar (fiyatlamada öncelikle dikkate al):\n"""\n${note}\n"""`;
}

// Gemini structured output şeması (generationConfig.responseSchema).
export const RESULT_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING, description: "İlan başlığı" },
    category: { type: SchemaType.STRING, description: "Genel ürün kategorisi" },
    condition: { type: SchemaType.STRING, description: "Tahmini durum" },
    currency: { type: SchemaType.STRING, description: "Para birimi, ör: TL" },
    quickSalePrice: { type: SchemaType.NUMBER, description: "Hızlı satış fiyatı" },
    optimalPrice: { type: SchemaType.NUMBER, description: "Optimal/önerilen fiyat" },
    listingText: { type: SchemaType.STRING, description: "Kopyalanmaya hazır ilan metni" },
    isElectronics: { type: SchemaType.BOOLEAN, description: "Elektronik cihaz mı?" },
    reasoning: { type: SchemaType.STRING, description: "Kısa fiyat gerekçesi" },
    isClothing: { type: SchemaType.BOOLEAN, description: "Giyim/moda ürünü mü?" },
    brand: { type: SchemaType.STRING, description: "Marka veya 'Bilinmiyor'" },
    size: { type: SchemaType.STRING, description: "Beden veya '-'" },
    color: { type: SchemaType.STRING, description: "Renk veya '-'" },
    gender: { type: SchemaType.STRING, description: "Departman: Kadın/Erkek/Unisex/Çocuk veya '-'" },
    clothingCategory: { type: SchemaType.STRING, description: "Dolap kategori yolu veya '-'" },
    material: { type: SchemaType.STRING, description: "Kumaş/materyal veya '-'" },
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
    "isClothing",
    "brand",
    "size",
    "color",
    "gender",
    "clothingCategory",
    "material",
  ],
};
