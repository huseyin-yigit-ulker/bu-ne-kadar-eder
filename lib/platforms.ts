// İkinci el pazaryerlerine "entegrasyon".
//
// ÖNEMLİ: Dolap, Letgo, Sahibinden gibi platformların bireysel/C2C ilan oluşturma
// için halka açık API'si YOKTUR (Sahibinden API'si yalnızca kurumsal mağazalara,
// Trendyol/Dolap API'si yalnızca pazaryeri satıcılarına açıktır). Bu yüzden doğrudan
// otomatik ilan yayınlamak mümkün değil. Bunun yerine:
//   1) İlanı her platformun diline göre biçimlendiriyoruz,
//   2) Telefonda Web Share API ile fotoğraf + metni doğrudan o uygulamaya gönderiyoruz,
//   3) Masaüstünde metni panoya kopyalayıp platformun sitesini açıyoruz.

import type { AnalysisResult } from "./types";

export const SHARE_WATERMARK = "✨ BuNeKadarEder AI ile oluşturuldu";

export interface Platform {
  id: string;
  label: string;
  emoji: string;
  /** Masaüstü fallback: paylaşım yoksa açılacak site */
  url?: string;
  /** Sadece giyim ürünlerinde göster */
  clothingOnly?: boolean;
  /** İlanı bu platformun diline göre biçimlendir */
  format: (r: AnalysisResult) => string;
}

function priceLine(r: AnalysisResult): string {
  return `Fiyat: ${r.optimalPrice} ${r.currency} (pazarlık payı: ${r.quickSalePrice} ${r.currency})`;
}

function clothingSpecs(r: AnalysisResult): string {
  return [
    r.brand && r.brand !== "-" ? `Marka: ${r.brand}` : "",
    r.size && r.size !== "-" ? `Beden: ${r.size}` : "",
    r.color && r.color !== "-" ? `Renk: ${r.color}` : "",
    r.material && r.material !== "-" ? `Materyal: ${r.material}` : "",
    `Durum: ${r.condition}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export const PLATFORMS: Platform[] = [
  {
    id: "dolap",
    label: "Dolap",
    emoji: "👗",
    url: "https://dolap.com",
    clothingOnly: true,
    // Dolap: hashtagli, samimi giyim dili. listingText zaten hashtag içeriyor.
    format: (r) => [r.title, "", r.listingText, "", clothingSpecs(r), SHARE_WATERMARK].join("\n"),
  },
  {
    id: "letgo",
    label: "Letgo",
    emoji: "🔄",
    url: "https://www.letgo.com",
    // Letgo: kısa ve net, fiyat öne çıkar.
    format: (r) => [r.title, "", r.listingText, "", priceLine(r), SHARE_WATERMARK].join("\n"),
  },
  {
    id: "sahibinden",
    label: "Sahibinden",
    emoji: "🏷️",
    url: "https://www.sahibinden.com",
    // Sahibinden: daha detaylı, özellik + fiyat.
    format: (r) =>
      [
        r.title,
        "",
        r.listingText,
        "",
        `Kategori: ${r.category}`,
        `Durum: ${r.condition}`,
        priceLine(r),
        SHARE_WATERMARK,
      ].join("\n"),
  },
  {
    id: "other",
    label: "Diğer / Paylaş",
    emoji: "📤",
    // Genel: Instagram, WhatsApp vb. için.
    format: (r) => [r.title, "", r.listingText, "", priceLine(r), SHARE_WATERMARK].join("\n"),
  },
];

export function platformsFor(result: AnalysisResult): Platform[] {
  return PLATFORMS.filter((p) => !p.clothingOnly || result.isClothing);
}
