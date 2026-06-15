"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalysisResult, AnalyzeResponse } from "@/lib/types";
import { platformsFor, type Platform } from "@/lib/platforms";

const WATERMARK = "\n\n✨ Bu ilan BuNeKadarEder AI ile 5 saniyede oluşturuldu — bunekadareder.app";
const MAX_IMAGES = 5;

const LOADING_MESSAGES = [
  "Fotoğraflar inceleniyor...",
  "Ürün tanımlanıyor...",
  "Yapay zeka piyasa verilerini tarıyor...",
  "Fiyat aralığı hesaplanıyor...",
  "İlan metni yazılıyor...",
];

type Stage = "compose" | "loading" | "result" | "paywall";

interface PickedImage {
  dataUrl: string;
  base64: string;
  mediaType: string;
}

interface ScrapedListing {
  title: string;
  description: string;
  price: string;
  asDescription: string;
  imageBase64?: string;
  mediaType?: string;
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("compose");
  const [mode, setMode] = useState<"photo" | "url">("photo");
  const [images, setImages] = useState<PickedImage[]>([]);
  const [url, setUrl] = useState("");
  const [scraped, setScraped] = useState<ScrapedListing | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tarayıcı eklentisinden gelen veri: ?ext=<id> → ingest'ten oku → önizlemeye düş
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("ext");
    if (!id) return;
    window.history.replaceState({}, "", window.location.pathname);
    setMode("url");
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/ingest?id=${encodeURIComponent(id)}`);
        const data = await res.json();
        if (data.ok && data.listing) setScraped(data.listing as ScrapedListing);
        else setError(data.error ?? "Eklentiden gelen veri okunamadı.");
      } catch {
        setError("Eklentiden gelen veri okunamadı.");
      }
    })();
  }, []);

  const addFiles = useCallback(
    async (files: FileList) => {
      setError(null);
      const room = MAX_IMAGES - images.length;
      if (room <= 0) {
        setError(`En fazla ${MAX_IMAGES} fotoğraf ekleyebilirsin.`);
        return;
      }
      const chosen = Array.from(files).slice(0, room);
      try {
        const processed = await Promise.all(chosen.map((f) => downscaleImage(f)));
        setImages((prev) => [...prev, ...processed]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Fotoğraf işlenemedi.");
      }
    },
    [images.length],
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) void addFiles(e.target.files);
    e.target.value = "";
  };

  const removeImage = (i: number) =>
    setImages((prev) => prev.filter((_, idx) => idx !== i));

  const runAnalyze = async (endpoint: string, payload: unknown) => {
    setError(null);
    setCopied(false);
    setStage("loading");

    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[i]);
    }, 1400);

    try {
      let data: AnalyzeResponse;
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        data = (await res.json()) as AnalyzeResponse;
      } finally {
        clearInterval(interval);
      }

      if (data.paywall) {
        setStage("paywall");
        return;
      }
      if (!data.ok || !data.result) {
        setError(data.error ?? "Bir hata oluştu.");
        setStage("compose");
        return;
      }
      setResult(data.result);
      setStage("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analiz başarısız oldu.");
      setStage("compose");
    }
  };

  const analyzePhoto = () => {
    if (images.length === 0) return;
    void runAnalyze("/api/analyze", {
      images: images.map((im) => ({ base64: im.base64, mediaType: im.mediaType })),
      description,
    });
  };

  // 1. adım: linkten veriyi çek (modele gitmez, hak harcamaz)
  const fetchPreview = async () => {
    if (!url.trim()) return;
    setError(null);
    setScraped(null);
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/preview-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Veri alınamadı.");
        return;
      }
      setScraped(data.listing as ScrapedListing);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Veri alınamadı.");
    } finally {
      setPreviewLoading(false);
    }
  };

  // 2. adım: çekilen veriyi onayla → modele gönder
  const analyzeScraped = () => {
    if (!scraped) return;
    const imgs =
      scraped.imageBase64 && scraped.mediaType
        ? [{ base64: scraped.imageBase64, mediaType: scraped.mediaType }]
        : [];
    const desc = [
      scraped.asDescription,
      description.trim() && `Kullanıcı notu: ${description.trim()}`,
    ]
      .filter(Boolean)
      .join("\n");
    void runAnalyze("/api/analyze", { images: imgs, description: desc });
  };

  const changeMode = (m: "photo" | "url") => {
    setMode(m);
    setScraped(null);
    setError(null);
  };

  const reset = () => {
    setStage("compose");
    setResult(null);
    setImages([]);
    setUrl("");
    setScraped(null);
    setPreviewLoading(false);
    setDescription("");
    setError(null);
    setCopied(false);
  };

  const copyListing = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.listingText + WATERMARK);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Kopyalama başarısız. Metni manuel seçin.");
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Dekoratif gradient blob arka plan */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-violet-300/40 blur-3xl" />
        <div className="absolute -right-20 top-40 h-72 w-72 rounded-full bg-sky-300/40 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-rose-200/40 blur-3xl" />
      </div>

      <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-6">
        <header className="mb-6 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-200/70 backdrop-blur">
            ✨ Yapay Zeka destekli
          </span>
          <h1 className="mt-3 bg-gradient-to-r from-violet-600 via-indigo-600 to-sky-500 bg-clip-text text-3xl font-black tracking-tight text-transparent">
            Bu Ne Kadar Eder?
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Fotoğrafla, detay yaz, saniyede fiyatını ve ilanını al.
          </p>
        </header>

        {stage === "compose" && (
          <ComposeView
            mode={mode}
            setMode={changeMode}
            images={images}
            url={url}
            setUrl={setUrl}
            scraped={scraped}
            previewLoading={previewLoading}
            onFetchPreview={fetchPreview}
            onClearScraped={() => setScraped(null)}
            onAnalyzeScraped={analyzeScraped}
            description={description}
            setDescription={setDescription}
            onPick={() => fileInputRef.current?.click()}
            onRemove={removeImage}
            onAnalyzePhoto={analyzePhoto}
            error={error}
          />
        )}

        {stage === "loading" && (
          <LoadingView preview={images[0]?.dataUrl ?? null} count={images.length} message={loadingMsg} />
        )}

        {stage === "result" && result && (
          <ResultView
            result={result}
            images={images}
            onCopy={copyListing}
            copied={copied}
            onReset={reset}
            error={error}
          />
        )}

        {stage === "paywall" && <PaywallView onReset={reset} />}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onInputChange}
        />

        <footer className="mt-auto pt-8 text-center text-xs text-slate-400">
          Üyelik yok · En fazla {MAX_IMAGES} fotoğraf · Birden fazla açıdan çekebilirsin
        </footer>
      </main>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-3xl border border-white/60 bg-white/80 shadow-xl shadow-slate-300/30 backdrop-blur-md ${className}`}
    >
      {children}
    </div>
  );
}

function ComposeView({
  mode,
  setMode,
  images,
  url,
  setUrl,
  scraped,
  previewLoading,
  onFetchPreview,
  onClearScraped,
  onAnalyzeScraped,
  description,
  setDescription,
  onPick,
  onRemove,
  onAnalyzePhoto,
  error,
}: {
  mode: "photo" | "url";
  setMode: (m: "photo" | "url") => void;
  images: PickedImage[];
  url: string;
  setUrl: (v: string) => void;
  scraped: ScrapedListing | null;
  previewLoading: boolean;
  onFetchPreview: () => void;
  onClearScraped: () => void;
  onAnalyzeScraped: () => void;
  description: string;
  setDescription: (v: string) => void;
  onPick: () => void;
  onRemove: (i: number) => void;
  onAnalyzePhoto: () => void;
  error: string | null;
}) {
  const hasImages = images.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Mod seçici */}
      <div className="flex rounded-2xl bg-white/70 p-1 shadow-sm ring-1 ring-slate-200 backdrop-blur">
        {(["photo", "url"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
              mode === m ? "bg-gradient-to-r from-violet-600 to-sky-500 text-white shadow" : "text-slate-500"
            }`}
          >
            {m === "photo" ? "📷 Fotoğraf" : "🔗 İlan Linki"}
          </button>
        ))}
      </div>

      {mode === "photo" ? (
        <PhotoCompose
          images={images}
          hasImages={hasImages}
          onPick={onPick}
          onRemove={onRemove}
          description={description}
          setDescription={setDescription}
          onAnalyze={onAnalyzePhoto}
          error={error}
        />
      ) : (
        <UrlCompose
          url={url}
          setUrl={setUrl}
          scraped={scraped}
          previewLoading={previewLoading}
          onFetchPreview={onFetchPreview}
          onClearScraped={onClearScraped}
          onAnalyzeScraped={onAnalyzeScraped}
          description={description}
          setDescription={setDescription}
          error={error}
        />
      )}
    </div>
  );
}

function PhotoCompose({
  images,
  hasImages,
  onPick,
  onRemove,
  description,
  setDescription,
  onAnalyze,
  error,
}: {
  images: PickedImage[];
  hasImages: boolean;
  onPick: () => void;
  onRemove: (i: number) => void;
  description: string;
  setDescription: (v: string) => void;
  onAnalyze: () => void;
  error: string | null;
}) {
  return (
    <>
      {!hasImages ? (
        <button
          onClick={onPick}
          className="group flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-violet-300/70 bg-white/70 px-6 py-16 text-center shadow-lg shadow-violet-200/30 backdrop-blur transition active:scale-[0.99]"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-sky-500 text-3xl shadow-lg shadow-violet-300/50">
            📷
          </div>
          <span className="text-base font-bold text-slate-800">Fotoğraf çek veya seç</span>
          <span className="text-sm text-slate-500">Birden fazla açıdan çekebilirsin</span>
        </button>
      ) : (
        <Card className="p-4">
          <div className="grid grid-cols-3 gap-2.5">
            {images.map((img, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-2xl ring-1 ring-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.dataUrl} alt={`Fotoğraf ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  onClick={() => onRemove(i)}
                  aria-label="Kaldır"
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-xs text-white backdrop-blur"
                >
                  ✕
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <button
                onClick={onPick}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-300 text-slate-400 transition active:scale-95"
              >
                <span className="text-2xl">＋</span>
                <span className="text-[11px] font-medium">Ekle</span>
              </button>
            )}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
          Detaylar (opsiyonel) — fiyat daha isabetli olur
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Örn: Zara mont, M beden, 2 kez giyildi, kusursuz, orijinal kutusu yok…"
          className="w-full resize-none rounded-2xl border border-slate-200 bg-white/80 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
        />
      </Card>

      {error && <ErrorNote text={error} />}

      {hasImages ? (
        <button
          onClick={onAnalyze}
          className="rounded-2xl bg-gradient-to-r from-violet-600 to-sky-500 py-4 text-base font-bold text-white shadow-lg shadow-violet-300/50 transition active:scale-[0.99]"
        >
          Fiyatla & İlan Oluştur 🚀
        </button>
      ) : (
        <Steps first="Fotoğraf(lar)ı ekle" />
      )}
    </>
  );
}

function UrlCompose({
  url,
  setUrl,
  scraped,
  previewLoading,
  onFetchPreview,
  onClearScraped,
  onAnalyzeScraped,
  description,
  setDescription,
  error,
}: {
  url: string;
  setUrl: (v: string) => void;
  scraped: ScrapedListing | null;
  previewLoading: boolean;
  onFetchPreview: () => void;
  onClearScraped: () => void;
  onAnalyzeScraped: () => void;
  description: string;
  setDescription: (v: string) => void;
  error: string | null;
}) {
  // ÖNİZLEME: veri çekildi, onay bekliyor
  if (scraped) {
    const imgSrc =
      scraped.imageBase64 && scraped.mediaType
        ? `data:${scraped.mediaType};base64,${scraped.imageBase64}`
        : null;
    return (
      <>
        <Card className="p-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-600">
            ✓ İlan verileri alındı
          </p>
          <div className="flex items-start gap-3">
            {imgSrc && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgSrc} alt={scraped.title} className="h-20 w-20 flex-shrink-0 rounded-2xl object-cover ring-1 ring-slate-200" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold leading-snug text-slate-900">
                {scraped.title || "(başlık okunamadı)"}
              </p>
              {scraped.price && <p className="mt-0.5 text-xs font-semibold text-violet-600">{scraped.price}</p>}
              {scraped.description && (
                <p className="mt-1 line-clamp-3 text-xs text-slate-500">{scraped.description}</p>
              )}
            </div>
          </div>
          {!imgSrc && (
            <p className="mt-3 text-[11px] text-amber-600">
              Görsel alınamadı — yalnızca metin verisiyle fiyatlanacak.
            </p>
          )}
        </Card>

        <Card className="p-4">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Ek not (opsiyonel)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Eklemek istediğin detay (kusur, gerçek durum vb.)"
            className="w-full resize-none rounded-2xl border border-slate-200 bg-white/80 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
        </Card>

        {error && <ErrorNote text={error} />}

        <button
          onClick={onAnalyzeScraped}
          className="rounded-2xl bg-gradient-to-r from-violet-600 to-sky-500 py-4 text-base font-bold text-white shadow-lg shadow-violet-300/50 transition active:scale-[0.99]"
        >
          Bu Verilerle Fiyatla 🚀
        </button>
        <button
          onClick={onClearScraped}
          className="rounded-2xl bg-white/80 py-3 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200 backdrop-blur"
        >
          Başka Link Dene
        </button>
      </>
    );
  }

  // 1. ADIM: link gir, veri çek
  return (
    <>
      <Card className="p-4">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
          İlan linki
        </label>
        <input
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.sahibinden.com/ilan/... veya başka bir ilan linki"
          className="w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
        />
        <p className="mt-2 text-[11px] leading-snug text-slate-400">
          Önce ilan verisi çekilir, sana gösterilir; onaylarsan fiyatlanır. Bazı siteler
          (Sahibinden, Dolap) otomatik erişimi engelleyebilir — o durumda fotoğraf yükleyin.
        </p>
      </Card>

      {error && <ErrorNote text={error} />}

      {url.trim().length > 0 ? (
        <button
          onClick={onFetchPreview}
          disabled={previewLoading}
          className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-sky-500 py-4 text-base font-bold text-white shadow-lg shadow-violet-300/50 transition active:scale-[0.99] disabled:opacity-60"
        >
          {previewLoading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Veriler getiriliyor…
            </>
          ) : (
            "Verileri Getir 🔎"
          )}
        </button>
      ) : (
        <Steps first="İlan linkini yapıştır" />
      )}
    </>
  );
}

function Steps({ first }: { first: string }) {
  return (
    <ol className="space-y-2 px-1 text-sm text-slate-500">
      <li>1️⃣ {first}</li>
      <li>2️⃣ Yapay zeka fiyatlasın</li>
      <li>3️⃣ İlanı kopyala, pazaryerinde sat 🚀</li>
    </ol>
  );
}

function ErrorNote({ text }: { text: string }) {
  return (
    <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">{text}</p>
  );
}

function LoadingView({
  preview,
  count,
  message,
}: {
  preview: string | null;
  count: number;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-10">
      <div className="relative h-56 w-56 overflow-hidden rounded-3xl bg-slate-200 shadow-xl shadow-slate-300/40">
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Yüklenen ürün" className="h-full w-full object-cover" />
        )}
        <div className="shimmer absolute inset-0 animate-shimmer" />
        {count > 1 && (
          <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
            +{count - 1} fotoğraf
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
        <p className="text-sm font-medium text-slate-600">{message}</p>
      </div>
    </div>
  );
}

function ResultView({
  result,
  images,
  onCopy,
  copied,
  onReset,
  error,
}: {
  result: AnalysisResult;
  images: PickedImage[];
  onCopy: () => void;
  copied: boolean;
  onReset: () => void;
  error: string | null;
}) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(n);

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-start gap-3 p-3">
        {images[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={images[0].dataUrl}
            alt={result.title}
            className="h-20 w-20 flex-shrink-0 rounded-2xl object-cover ring-1 ring-slate-200"
          />
        )}
        <div className="min-w-0">
          <h2 className="text-sm font-bold leading-snug text-slate-900">{result.title}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {result.category} · {result.condition}
          </p>
          {images.length > 1 && (
            <p className="mt-1 text-[11px] text-slate-400">{images.length} fotoğraf analiz edildi</p>
          )}
        </div>
      </Card>

      {result.isClothing && <DolapCard result={result} />}

      {/* Fiyat skalası */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 text-center">
          <p className="text-xs font-medium text-slate-400">Hızlı Satış</p>
          <p className="mt-1 text-xl font-extrabold text-slate-700">
            {fmt(result.quickSalePrice)}
            <span className="ml-1 text-sm font-semibold text-slate-400">{result.currency}</span>
          </p>
        </Card>
        <div className="rounded-3xl bg-gradient-to-br from-violet-600 to-sky-500 p-4 text-center text-white shadow-lg shadow-violet-300/40">
          <p className="text-xs font-medium text-violet-100">Optimal Fiyat</p>
          <p className="mt-1 text-xl font-extrabold">
            {fmt(result.optimalPrice)}
            <span className="ml-1 text-sm font-semibold text-violet-100">{result.currency}</span>
          </p>
        </div>
      </div>

      <p className="px-1 text-xs text-slate-400">💡 {result.reasoning}</p>

      {/* İlan metni */}
      <Card className="p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Kopyalanmaya hazır ilan
        </p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {result.listingText}
        </p>
      </Card>

      {result.isElectronics && (
        <a
          href="#"
          className="block rounded-3xl border border-amber-200 bg-amber-50/80 p-4 text-center backdrop-blur"
        >
          <p className="text-sm font-semibold text-amber-800">⚡ İlanla uğraşmak istemiyor musun?</p>
          <p className="mt-1 text-xs text-amber-700">Cihazını anında nakite çevir — Hemen Sat →</p>
        </a>
      )}

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      <PlatformShare result={result} images={images} />

      <button
        onClick={onCopy}
        className="rounded-2xl bg-gradient-to-r from-violet-600 to-sky-500 py-4 text-base font-bold text-white shadow-lg shadow-violet-300/50 transition active:scale-[0.99]"
      >
        {copied ? "✓ Kopyalandı!" : "İlan Metnini Kopyala"}
      </button>
      <button
        onClick={onReset}
        className="rounded-2xl bg-white/80 py-3 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200 backdrop-blur"
      >
        Yeni Ürün
      </button>
    </div>
  );
}

function PaywallView({ onReset }: { onReset: () => void }) {
  return (
    <Card className="flex flex-col items-center gap-5 p-6 text-center">
      <div className="text-4xl">🚀</div>
      <h2 className="text-lg font-bold text-slate-900">Günlük ücretsiz hakkın doldu</h2>
      <p className="text-sm text-slate-500">
        Daha fazla eşyanı saniyeler içinde fiyatlamak ve satmak için bir paket seç:
      </p>
      <div className="w-full space-y-3">
        <div className="rounded-2xl border border-violet-300/60 bg-violet-50/70 p-4 text-left">
          <p className="font-semibold text-slate-800">50 İlan Kredisi</p>
          <p className="text-sm text-slate-500">Tek seferlik · 49 TL</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4 text-left">
          <p className="font-semibold text-slate-800">Sınırsız Hafta Sonu</p>
          <p className="text-sm text-slate-500">2 gün sınırsız · 99 TL</p>
        </div>
      </div>
      <button className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-sky-500 py-4 text-base font-bold text-white shadow-lg shadow-violet-300/50">
        Paketi Al (yakında)
      </button>
      <button onClick={onReset} className="text-sm font-medium text-slate-400">
        Geri dön
      </button>
    </Card>
  );
}

// Dolap / Gardrops için yapılandırılmış alan kartı — her alan tek tıkla kopyalanır.
function DolapCard({ result }: { result: AnalysisResult }) {
  const rows: { label: string; value: string }[] = [
    { label: "Marka", value: result.brand },
    { label: "Beden", value: result.size },
    { label: "Renk", value: result.color },
    { label: "Departman", value: result.gender },
    { label: "Kategori", value: result.clothingCategory },
    { label: "Materyal", value: result.material },
    { label: "Durum", value: result.condition },
  ].filter((r) => r.value && r.value !== "-" && r.value.toLowerCase() !== "bilinmiyor");

  return (
    <div className="rounded-3xl border border-rose-200/70 bg-rose-50/60 p-4 shadow-sm backdrop-blur">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-rose-600">
        👗 Dolap için hazır alanlar
      </p>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <CopyRow key={r.label} label={r.label} value={r.value} />
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-snug text-rose-500/80">
        Alanlara dokunarak tek tek kopyala, Dolap ilan formuna yapıştır.
      </p>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      /* yoksay */
    }
  };
  return (
    <button
      onClick={copy}
      className="flex w-full items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-left shadow-sm transition active:scale-[0.99]"
    >
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <span className="flex items-center gap-2 truncate text-sm font-semibold text-slate-700">
        <span className="truncate">{value}</span>
        <span className="text-xs text-rose-400">{done ? "✓" : "📋"}</span>
      </span>
    </button>
  );
}

// Pazaryeri paylaşım bileşeni — platform seç, native paylaşımla (foto + metin) gönder.
function PlatformShare({ result, images }: { result: AnalysisResult; images: PickedImage[] }) {
  const [msg, setMsg] = useState<string | null>(null);
  const platforms = platformsFor(result);

  const handle = async (p: Platform) => {
    setMsg(null);
    const text = p.format(result);
    const files = images
      .map((im, i) => dataUrlToFile(im.dataUrl, `urun-${i + 1}.jpg`))
      .filter((f): f is File => f !== null);

    const shareData: ShareData = { title: result.title, text };
    const canFiles =
      files.length > 0 &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files });
    if (canFiles) shareData.files = files;

    // 1) Telefonda native paylaşım (fotoğraf + metin doğrudan uygulamaya)
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        return;
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return; // kullanıcı vazgeçti
        // paylaşım başarısızsa fallback'e düş
      }
    }

    // 2) Masaüstü fallback: metni kopyala + platformu aç
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* yoksay */
    }
    if (p.url) window.open(p.url, "_blank", "noopener,noreferrer");
    setMsg(
      p.url
        ? `Metin kopyalandı, ${p.label} açıldı — ilan formuna yapıştır.`
        : "İlan metni panoya kopyalandı.",
    );
    setTimeout(() => setMsg(null), 4000);
  };

  return (
    <div className="rounded-3xl border border-white/60 bg-white/80 p-4 shadow-xl shadow-slate-300/30 backdrop-blur-md">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Pazaryerine gönder 📤
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        {platforms.map((p) => (
          <button
            key={p.id}
            onClick={() => handle(p)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-slate-800 to-slate-700 py-3 text-sm font-bold text-white shadow-md transition active:scale-[0.98]"
          >
            <span>{p.emoji}</span>
            {p.label}
          </button>
        ))}
      </div>
      {msg && <p className="mt-3 text-center text-xs font-medium text-emerald-600">{msg}</p>}
      <p className="mt-3 text-[11px] leading-snug text-slate-400">
        Telefonda fotoğraf + metin doğrudan uygulamaya gönderilir. Masaüstünde metin
        kopyalanır, site açılır. (Dolap/Letgo/Sahibinden bireysel ilan API'si sunmadığı için
        otomatik yayın yapılamaz.)
      </p>
    </div>
  );
}

// dataURL → File (Web Share API ile fotoğraf paylaşmak için)
function dataUrlToFile(dataUrl: string, name: string): File | null {
  try {
    const [head, b64] = dataUrl.split(",");
    const mime = head.match(/data:(.*?);/)?.[1] ?? "image/jpeg";
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new File([arr], name, { type: mime });
  } catch {
    return null;
  }
}

// --- Yardımcı: fotoğrafı tarayıcıda küçültüp base64'e çevir ---
async function downscaleImage(
  file: File,
  maxDim = 1280,
): Promise<PickedImage> {
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas desteklenmiyor.");
  ctx.drawImage(img, 0, 0, w, h);

  const mediaType = "image/jpeg";
  const out = canvas.toDataURL(mediaType, 0.85);
  const base64 = out.split(",")[1] ?? "";
  return { dataUrl: out, base64, mediaType };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Dosya okunamadı."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Görsel yüklenemedi."));
    img.src = src;
  });
}
