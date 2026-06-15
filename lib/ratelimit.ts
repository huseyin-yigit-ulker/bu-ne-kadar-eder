// Basit, bellek-içi IP bazlı günlük limit takibi (MVP).
//
// ÜRETİM NOTU: Serverless/çok-instanceli ortamda (Vercel) bellek paylaşılmaz.
// Gerçek limitleme için Supabase (PostgreSQL) veya Upstash Redis kullanın.
// Bu modül arayüzü aynı kalacak şekilde tasarlandı; sadece store'u değiştirin.

interface Bucket {
  count: number;
  /** Bu pencerenin sıfırlanacağı epoch ms */
  resetAt: number;
}

const store = new Map<string, Bucket>();

const DAY_MS = 24 * 60 * 60 * 1000;

function freeLimit(): number {
  const n = parseInt(process.env.FREE_DAILY_LIMIT ?? "2", 10);
  return Number.isFinite(n) && n > 0 ? n : 2;
}

export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  limit: number;
}

/** Hak var mı diye bakar AMA tüketmez. */
export function peek(ip: string): RateLimitStatus {
  const limit = freeLimit();
  const now = Date.now();
  const bucket = store.get(ip);
  if (!bucket || now > bucket.resetAt) {
    return { allowed: true, remaining: limit, limit };
  }
  return {
    allowed: bucket.count < limit,
    remaining: Math.max(0, limit - bucket.count),
    limit,
  };
}

/** Bir hak tüketir; tüketildikten sonraki durumu döner. */
export function consume(ip: string): RateLimitStatus {
  const limit = freeLimit();
  const now = Date.now();
  let bucket = store.get(ip);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + DAY_MS };
  }
  bucket.count += 1;
  store.set(ip, bucket);
  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    limit,
  };
}

/** İstekten IP adresini çıkarır (Vercel/standart proxy header'ları). */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "anonymous";
}
