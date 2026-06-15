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

export interface AnalyzeResponse {
  ok: boolean;
  result?: AnalysisResult;
  error?: string;
  /** Kalan ücretsiz hak */
  remaining?: number;
  /** Limit dolduysa true (paywall tetikleyici) */
  paywall?: boolean;
}
