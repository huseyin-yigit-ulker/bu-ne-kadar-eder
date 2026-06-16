// "Bu Ne Kadar Eder?" — paylaşılan tipler

export interface AnalysisResult {
  /** Pazaryeri için optimize edilmiş ilan başlığı, ör: "Zara Oversize Triko Kazak, Bej, M Beden" */
  title: string;
  /** Genel ürün kategorisi, ör: "Üst Giyim" */
  category: string;
  /** Tahmini durum, ör: "Sıfır gibi", "İyi", "Kusurlu" */
  condition: string;
  /** Para birimi (varsayılan TL) */
  currency: string;
  /** Hızlı satış fiyatı (alt bant) */
  quickSalePrice: number;
  /** Optimal/önerilen fiyat (üst bant) */
  optimalPrice: number;
  /** Emojilerle desteklenmiş, kopyalanmaya hazır ilan metni (giyimde hashtagli, Dolap dilinde) */
  listingText: string;
  /** Bu bir elektronik cihaz mı? (affiliate butonu için) */
  isElectronics: boolean;
  /** Kısa fiyat gerekçesi */
  reasoning: string;

  // --- Giyim / moda alanları (Dolap, Gardrops, Vinted entegrasyonu) ---
  /** Bu bir giyim/moda ürünü mü? (kıyafet, ayakkabı, çanta, aksesuar) */
  isClothing: boolean;
  /** Marka, ör: "Zara". Bilinmiyorsa "Bilinmiyor". */
  brand: string;
  /** Beden, ör: "M", "38", "40". Yoksa "-". */
  size: string;
  /** Renk, ör: "Bej". Yoksa "-". */
  color: string;
  /** Departman, ör: "Kadın", "Erkek", "Unisex", "Çocuk". Yoksa "-". */
  gender: string;
  /** Dolap tarzı kategori yolu, ör: "Kadın > Üst Giyim > Triko". Yoksa "-". */
  clothingCategory: string;
  /** Kumaş/materyal, ör: "Pamuk". Bilinmiyorsa "-". */
  material: string;
}

// "Almadan Önce" — her ürün için alıcı asistanı analizi
export interface ProductAnalysis {
  /** Normalize başlık, ör: "Apple iPhone 13 128GB" / "Ford Focus 1.6 TDCi, 2015" */
  title: string;
  /** Ürün kategorisi, ör: "Akıllı Telefon", "Otomobil", "Koltuk Takımı" */
  category: string;
  /** Marka veya "-" */
  brand: string;
  /** Ürünü belirleyen önemli özellikler (kategoriye göre): yıl/km, hafıza/pil, ölçü/malzeme... */
  keySpecs: string[];
  /** Tahmini durum */
  condition: string;
  /** İlanda istenen fiyat, "385.000 TL" veya "-" */
  listedPrice: string;
  /** Tahmini adil piyasa değeri alt bandı (TL) */
  fairValueLow: number;
  /** Tahmini adil piyasa değeri üst bandı (TL) */
  fairValueHigh: number;
  currency: string;
  /** Fiyat hükmü: "ucuz" | "uygun" | "pahalı" | "belirsiz" */
  priceVerdict: string;
  /** Fiyat konumu açıklaması, ör: "Piyasanın ~%8 altında" */
  pricePosition: string;
  /** Benzer ürünler / emsaller. url varsa gerçek ilan (arama API'si); yoksa AI tahmini. */
  comparables: { label: string; price: string; note: string; url?: string; source?: string }[];
  pros: string[];
  cons: string[];
  /** Alıcıya tavsiyeler / sorulacak sorular / kontroller */
  advice: string[];
  /** Risk/uyarılar */
  risks: string[];
  /** Tek paragraf alıcı özeti */
  summary: string;
  /** Veri kalitesi / güven notu */
  confidence: string;
}

export interface AppraiseResponse {
  ok: boolean;
  result?: ProductAnalysis;
  /** Çekilen ham ilan bilgisi (önizleme/şeffaflık için) */
  source?: { title: string; price: string; from: string };
  error?: string;
  remaining?: number;
  paywall?: boolean;
  /** Site engelledi → kullanıcıdan ilan detayını iste */
  needsDetails?: boolean;
}

export interface AnalyzeResponse {
  ok: boolean;
  result?: AnalysisResult;
  error?: string;
  /** Kalan ücretsiz hak */
  remaining?: number;
  /** Limit dolduysa true (paywall tetikleyici) */
  paywall?: boolean;
}
