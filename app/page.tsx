"use client";

import { useCallback, useRef, useState } from "react";
import type { AnalysisResult, AnalyzeResponse } from "@/lib/types";

const WATERMARK = "\n\n✨ Bu ilan BuNeKadarEder AI ile 5 saniyede oluşturuldu — bunekadareder.app";

const LOADING_MESSAGES = [
  "Fotoğraf inceleniyor...",
  "Ürün tanımlanıyor...",
  "Yapay zeka piyasa verilerini tarıyor...",
  "Fiyat aralığı hesaplanıyor...",
  "İlan metni yazılıyor...",
];

type Stage = "upload" | "loading" | "result" | "paywall";

export default function Home() {
  const [stage, setStage] = useState<Stage>("upload");
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setCopied(false);

    try {
      const { dataUrl, base64, mediaType } = await downscaleImage(file);
      setPreview(dataUrl);
      setStage("loading");

      // Yükleme mesajlarını döngüye al
      let i = 0;
      const interval = setInterval(() => {
        i = (i + 1) % LOADING_MESSAGES.length;
        setLoadingMsg(LOADING_MESSAGES[i]);
      }, 1400);

      let data: AnalyzeResponse;
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mediaType }),
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
        setStage("upload");
        return;
      }

      setResult(data.result);
      setStage("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fotoğraf işlenemedi.");
      setStage("upload");
    }
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = ""; // aynı dosya tekrar seçilebilsin
  };

  const reset = () => {
    setStage("upload");
    setResult(null);
    setPreview(null);
    setError(null);
    setCopied(false);
  };

  const copyListing = async () => {
    if (!result) return;
    const text = result.listingText + WATERMARK;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Kopyalama başarısız. Metni manuel seçin.");
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-6">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          Bu Ne Kadar Eder? <span className="text-brand">🔍</span>
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Fotoğrafını çek, saniyede fiyatını öğren ve ilanını al.
        </p>
      </header>

      {stage === "upload" && (
        <UploadView
          onPick={() => fileInputRef.current?.click()}
          error={error}
        />
      )}

      {stage === "loading" && <LoadingView preview={preview} message={loadingMsg} />}

      {stage === "result" && result && (
        <ResultView
          result={result}
          preview={preview}
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
        capture="environment"
        className="hidden"
        onChange={onInputChange}
      />

      <footer className="mt-auto pt-8 text-center text-xs text-slate-400">
        Üyelik yok · IP başına günde 2 ücretsiz tarama
      </footer>
    </main>
  );
}

function UploadView({ onPick, error }: { onPick: () => void; error: string | null }) {
  return (
    <div className="flex flex-col items-center gap-5">
      <button
        onClick={onPick}
        className="group flex w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm transition active:scale-[0.99]"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-3xl">
          📷
        </div>
        <span className="text-base font-semibold text-slate-800">
          Eşyanın fotoğrafını çek
        </span>
        <span className="text-sm text-slate-500">veya galeriden seç</span>
      </button>

      {error && (
        <p className="w-full rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <ol className="w-full space-y-2 text-sm text-slate-500">
        <li>1️⃣ Fotoğrafı yükle</li>
        <li>2️⃣ Yapay zeka fiyatlasın</li>
        <li>3️⃣ İlanı kopyala, sat 🚀</li>
      </ol>
    </div>
  );
}

function LoadingView({ preview, message }: { preview: string | null; message: string }) {
  return (
    <div className="flex flex-col items-center gap-6 py-10">
      <div className="relative h-56 w-56 overflow-hidden rounded-2xl bg-slate-200 shadow-md">
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Yüklenen ürün" className="h-full w-full object-cover" />
        )}
        <div className="shimmer absolute inset-0 animate-shimmer" />
      </div>
      <div className="flex items-center gap-3">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        <p className="text-sm font-medium text-slate-600">{message}</p>
      </div>
    </div>
  );
}

function ResultView({
  result,
  preview,
  onCopy,
  copied,
  onReset,
  error,
}: {
  result: AnalysisResult;
  preview: string | null;
  onCopy: () => void;
  copied: boolean;
  onReset: () => void;
  error: string | null;
}) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(n);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-2xl bg-white p-3 shadow-sm">
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt={result.title}
            className="h-20 w-20 flex-shrink-0 rounded-xl object-cover"
          />
        )}
        <div className="min-w-0">
          <h2 className="text-sm font-bold leading-snug text-slate-900">{result.title}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {result.category} · {result.condition}
          </p>
        </div>
      </div>

      {/* Fiyat skalası */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
          <p className="text-xs font-medium text-slate-400">Hızlı Satış</p>
          <p className="mt-1 text-xl font-extrabold text-slate-700">
            {fmt(result.quickSalePrice)}
            <span className="ml-1 text-sm font-semibold text-slate-400">{result.currency}</span>
          </p>
        </div>
        <div className="rounded-2xl bg-brand p-4 text-center text-white shadow-sm">
          <p className="text-xs font-medium text-sky-100">Optimal Fiyat</p>
          <p className="mt-1 text-xl font-extrabold">
            {fmt(result.optimalPrice)}
            <span className="ml-1 text-sm font-semibold text-sky-100">{result.currency}</span>
          </p>
        </div>
      </div>

      <p className="px-1 text-xs text-slate-400">💡 {result.reasoning}</p>

      {/* İlan metni */}
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Kopyalanmaya hazır ilan
        </p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {result.listingText}
        </p>
      </div>

      {/* Affiliate fırsatı (gizli gelir) */}
      {result.isElectronics && (
        <a
          href="#"
          className="block rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center"
        >
          <p className="text-sm font-semibold text-amber-800">
            ⚡ İlanla uğraşmak istemiyor musun?
          </p>
          <p className="mt-1 text-xs text-amber-700">
            Cihazını anında nakite çevir — Hemen Sat →
          </p>
        </a>
      )}

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      <button
        onClick={onCopy}
        className="rounded-2xl bg-brand py-4 text-base font-bold text-white shadow-md transition active:scale-[0.99]"
      >
        {copied ? "✓ Kopyalandı!" : "İlanı Kopyala"}
      </button>
      <button
        onClick={onReset}
        className="rounded-2xl bg-white py-3 text-sm font-semibold text-slate-600 shadow-sm"
      >
        Yeni Fotoğraf
      </button>
    </div>
  );
}

function PaywallView({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-5 rounded-3xl bg-white p-6 text-center shadow-sm">
      <div className="text-4xl">🚀</div>
      <h2 className="text-lg font-bold text-slate-900">Günlük ücretsiz hakkın doldu</h2>
      <p className="text-sm text-slate-500">
        Daha fazla eşyanı saniyeler içinde fiyatlamak ve satmak için bir paket seç:
      </p>
      <div className="w-full space-y-3">
        <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4 text-left">
          <p className="font-semibold text-slate-800">50 İlan Kredisi</p>
          <p className="text-sm text-slate-500">Tek seferlik · 49 TL</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4 text-left">
          <p className="font-semibold text-slate-800">Sınırsız Hafta Sonu</p>
          <p className="text-sm text-slate-500">2 gün sınırsız · 99 TL</p>
        </div>
      </div>
      <button className="w-full rounded-2xl bg-brand py-4 text-base font-bold text-white shadow-md">
        Paketi Al (yakında)
      </button>
      <button onClick={onReset} className="text-sm font-medium text-slate-400">
        Geri dön
      </button>
    </div>
  );
}

// --- Yardımcı: fotoğrafı tarayıcıda küçültüp base64'e çevir ---
async function downscaleImage(
  file: File,
  maxDim = 1280,
): Promise<{ dataUrl: string; base64: string; mediaType: string }> {
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
