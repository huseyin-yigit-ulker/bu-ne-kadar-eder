"use client";

import { useEffect, useState } from "react";
import type { VehicleAnalysis, VehicleResponse } from "@/lib/types";

const LOADING_MESSAGES = [
  "İlan okunuyor...",
  "Araç tanımlanıyor...",
  "Piyasa değeri hesaplanıyor...",
  "Artılar ve eksiler çıkarılıyor...",
  "Alıcı tavsiyeleri hazırlanıyor...",
];

type Stage = "compose" | "loading" | "result" | "paywall";

export default function Home() {
  const [stage, setStage] = useState<Stage>("compose");
  const [url, setUrl] = useState("");
  const [details, setDetails] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [result, setResult] = useState<VehicleAnalysis | null>(null);
  const [source, setSource] = useState<VehicleResponse["source"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);

  // Tarayıcı eklentisinden gelen veri: ?ext=<id> → ingest oku → otomatik analiz et
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("ext");
    if (!id) return;
    window.history.replaceState({}, "", window.location.pathname);
    (async () => {
      try {
        const res = await fetch(`/api/ingest?id=${encodeURIComponent(id)}`);
        const data = await res.json();
        if (data.ok && data.listing) {
          const l = data.listing;
          const text = [l.title, l.price, l.description].filter(Boolean).join("\n");
          setDetails(text);
          setShowDetails(true);
          void run({ details: text });
        } else {
          setError(data.error ?? "Eklentiden gelen veri okunamadı.");
        }
      } catch {
        setError("Eklentiden gelen veri okunamadı.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (payload: { url?: string; details?: string }) => {
    setError(null);
    setStage("loading");
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[i]);
    }, 1400);
    try {
      let data: VehicleResponse;
      try {
        const res = await fetch("/api/value", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        data = (await res.json()) as VehicleResponse;
      } finally {
        clearInterval(interval);
      }
      if (data.paywall) {
        setStage("paywall");
        return;
      }
      if (!data.ok || !data.result) {
        setError(data.error ?? "Bir hata oluştu.");
        if (data.needsDetails) setShowDetails(true);
        setStage("compose");
        return;
      }
      setResult(data.result);
      setSource(data.source ?? null);
      setStage("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analiz başarısız oldu.");
      setStage("compose");
    }
  };

  const analyze = () => {
    if (!url.trim() && !details.trim()) return;
    void run({ url: url.trim() || undefined, details: details.trim() || undefined });
  };

  const reset = () => {
    setStage("compose");
    setResult(null);
    setSource(null);
    setUrl("");
    setDetails("");
    setShowDetails(false);
    setError(null);
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-300/40 blur-3xl" />
        <div className="absolute -right-20 top-40 h-72 w-72 rounded-full bg-sky-300/40 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-indigo-200/40 blur-3xl" />
      </div>

      <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-6">
        <header className="mb-6 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/70 backdrop-blur">
            🚗 Akıllı alım asistanı
          </span>
          <h1 className="mt-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-500 bg-clip-text text-3xl font-black tracking-tight text-transparent">
            Almadan Önce
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            İlan linkini yapıştır; fiyatı piyasayla kıyaslayalım, artı-eksisini söyleyelim.
          </p>
        </header>

        {stage === "compose" && (
          <ComposeView
            url={url}
            setUrl={setUrl}
            details={details}
            setDetails={setDetails}
            showDetails={showDetails}
            setShowDetails={setShowDetails}
            onAnalyze={analyze}
            error={error}
          />
        )}
        {stage === "loading" && <LoadingView message={loadingMsg} />}
        {stage === "result" && result && (
          <ResultView result={result} source={source} onReset={reset} />
        )}
        {stage === "paywall" && <PaywallView onReset={reset} />}

        <footer className="mt-auto pt-8 text-center text-xs text-slate-400">
          Üyelik yok · Tahmini değerlendirme; nihai karar ekspertizle verilmelidir.
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
  url,
  setUrl,
  details,
  setDetails,
  showDetails,
  setShowDetails,
  onAnalyze,
  error,
}: {
  url: string;
  setUrl: (v: string) => void;
  details: string;
  setDetails: (v: string) => void;
  showDetails: boolean;
  setShowDetails: (v: boolean) => void;
  onAnalyze: () => void;
  error: string | null;
}) {
  const canSubmit = url.trim().length > 0 || details.trim().length > 0;
  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
          Araç ilan linki
        </label>
        <input
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.sahibinden.com/ilan/... veya letgo / arabam linki"
          className="w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        />
        <p className="mt-2 text-[11px] leading-snug text-slate-400">
          Bazı siteler (ör. Sahibinden) otomatik erişimi engelleyebilir. Engellenirse ilan
          bilgilerini elle yapıştırabilirsin.
        </p>
      </Card>

      {!showDetails ? (
        <button
          onClick={() => setShowDetails(true)}
          className="self-start px-1 text-xs font-medium text-emerald-600"
        >
          + İlan detayını elle gir
        </button>
      ) : (
        <Card className="p-4">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            İlan detayı (marka, model, yıl, km, fiyat, açıklama)
          </label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={5}
            placeholder="Ör: Ford Focus 1.6 TDCi Trend X, 2015, 150.000 km, 385.000 TL, değişensiz, masrafsız..."
            className="w-full resize-none rounded-2xl border border-slate-200 bg-white/80 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
        </Card>
      )}

      {error && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
          {error}
        </p>
      )}

      {canSubmit ? (
        <button
          onClick={onAnalyze}
          className="rounded-2xl bg-gradient-to-r from-emerald-600 to-sky-500 py-4 text-base font-bold text-white shadow-lg shadow-emerald-300/50 transition active:scale-[0.99]"
        >
          Almadan Önce Analiz Et 🔍
        </button>
      ) : (
        <ol className="space-y-2 px-1 text-sm text-slate-500">
          <li>1️⃣ Araç ilan linkini yapıştır</li>
          <li>2️⃣ Fiyatı piyasayla kıyaslayalım</li>
          <li>3️⃣ Artı-eksi + alıcı tavsiyesini al ✅</li>
        </ol>
      )}
    </div>
  );
}

function LoadingView({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-6 py-16">
      <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500 to-sky-500 text-4xl shadow-xl shadow-emerald-300/40">
        🚗
        <div className="shimmer absolute inset-0 animate-shimmer rounded-3xl" />
      </div>
      <div className="flex items-center gap-3">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        <p className="text-sm font-medium text-slate-600">{message}</p>
      </div>
    </div>
  );
}

const VERDICT: Record<string, { label: string; cls: string }> = {
  ucuz: { label: "UCUZ — fırsat olabilir", cls: "bg-emerald-500" },
  uygun: { label: "UYGUN — piyasa seviyesinde", cls: "bg-sky-500" },
  pahalı: { label: "PAHALI — piyasanın üstünde", cls: "bg-rose-500" },
  belirsiz: { label: "BELİRSİZ — veri yetersiz", cls: "bg-slate-400" },
};

function ResultView({
  result,
  source,
  onReset,
}: {
  result: VehicleAnalysis;
  source: VehicleResponse["source"] | null;
  onReset: () => void;
}) {
  const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(n);
  const v = VERDICT[result.priceVerdict] ?? VERDICT.belirsiz;
  const specs = [result.year, result.km].filter((x) => x && x !== "-").join(" · ");

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <h2 className="text-base font-bold leading-snug text-slate-900">{result.title}</h2>
        <p className="mt-1 text-xs text-slate-500">
          {[result.make, result.model].filter(Boolean).join(" ")}
          {specs && ` · ${specs}`}
        </p>
        <div className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold text-white ${v.cls}`}>
          {v.label}
        </div>
        {result.pricePosition && (
          <p className="mt-2 text-sm font-medium text-slate-600">{result.pricePosition}</p>
        )}
      </Card>

      {/* Fiyat: istenen vs adil değer */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 text-center">
          <p className="text-xs font-medium text-slate-400">İstenen fiyat</p>
          <p className="mt-1 text-lg font-extrabold text-slate-700">{result.listedPrice || "-"}</p>
        </Card>
        <div className="rounded-3xl bg-gradient-to-br from-emerald-600 to-sky-500 p-4 text-center text-white shadow-lg shadow-emerald-300/40">
          <p className="text-xs font-medium text-emerald-100">Adil değer aralığı</p>
          <p className="mt-1 text-base font-extrabold leading-tight">
            {fmt(result.fairValueLow)} – {fmt(result.fairValueHigh)}
            <span className="ml-1 text-xs font-semibold text-emerald-100">{result.currency}</span>
          </p>
        </div>
      </div>

      <ListCard title="✅ Artılar" items={result.pros} tone="emerald" />
      <ListCard title="⚠️ Eksiler / şüpheler" items={result.cons} tone="rose" />
      <ListCard title="💡 Alıcı tavsiyeleri" items={result.advice} tone="sky" />
      <ListCard title="🚨 Riskler" items={result.risks} tone="amber" />

      {result.summary && (
        <Card className="p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Özet</p>
          <p className="text-sm leading-relaxed text-slate-700">{result.summary}</p>
        </Card>
      )}

      {result.confidence && (
        <p className="px-1 text-[11px] leading-snug text-slate-400">ℹ️ {result.confidence}</p>
      )}
      {source?.from && (
        <p className="px-1 text-[11px] text-slate-400">
          Kaynak: {source.from}
          {source.title ? ` — ${source.title}` : ""}
        </p>
      )}

      <button
        onClick={onReset}
        className="mt-1 rounded-2xl bg-gradient-to-r from-emerald-600 to-sky-500 py-4 text-base font-bold text-white shadow-lg shadow-emerald-300/50 transition active:scale-[0.99]"
      >
        Yeni Analiz
      </button>
    </div>
  );
}

function ListCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "emerald" | "rose" | "sky" | "amber";
}) {
  if (!items || items.length === 0) return null;
  const dot = {
    emerald: "text-emerald-500",
    rose: "text-rose-500",
    sky: "text-sky-500",
    amber: "text-amber-500",
  }[tone];
  return (
    <Card className="p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-700">
            <span className={dot}>•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PaywallView({ onReset }: { onReset: () => void }) {
  return (
    <Card className="flex flex-col items-center gap-5 p-6 text-center">
      <div className="text-4xl">🚗</div>
      <h2 className="text-lg font-bold text-slate-900">Günlük ücretsiz hakkın doldu</h2>
      <p className="text-sm text-slate-500">Daha fazla araç analizi için bir paket seç:</p>
      <div className="w-full space-y-3">
        <div className="rounded-2xl border border-emerald-300/60 bg-emerald-50/70 p-4 text-left">
          <p className="font-semibold text-slate-800">20 Analiz Kredisi</p>
          <p className="text-sm text-slate-500">Tek seferlik · 49 TL</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4 text-left">
          <p className="font-semibold text-slate-800">Araba Alırken — Hafta</p>
          <p className="text-sm text-slate-500">7 gün sınırsız · 99 TL</p>
        </div>
      </div>
      <button className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-sky-500 py-4 text-base font-bold text-white shadow-lg shadow-emerald-300/50">
        Paketi Al (yakında)
      </button>
      <button onClick={onReset} className="text-sm font-medium text-slate-400">
        Geri dön
      </button>
    </Card>
  );
}
