// "Bu Ne Kadar Eder?" — paylaşılan tipler

export interface AnalysisResult {
  /** Pazaryeri için optimize edilmiş ilan başlığı, ör: "Kusursuz Durumda, Kutulu Philips Airfryer XXL" */
  title: string;
  /** Ürün kategorisi, ör: "Küçük Ev Aleti" */
  category: string;
  /** Tahmini durum, ör: "Sıfır gibi", "İyi", "Kusurlu" */
  condition: string;
  /** Para birimi (varsayılan TL) */
  currency: string;
  /** Hızlı satış fiyatı (alt bant) */
  quickSalePrice: number;
  /** Optimal/önerilen fiyat (üst bant) */
  optimalPrice: number;
  /** Emojilerle desteklenmiş, kopyalanmaya hazır ilan metni */
  listingText: string;
  /** Bu bir elektronik cihaz mı? (affiliate butonu için) */
  isElectronics: boolean;
  /** Kısa fiyat gerekçesi */
  reasoning: string;
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
