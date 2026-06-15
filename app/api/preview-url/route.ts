import { NextResponse } from "next/server";
import { fetchListing } from "@/lib/scrape";

export const runtime = "nodejs";
export const maxDuration = 30;

// İlan linkinden veriyi ÇEKER (modele göndermez, ücretsiz hak harcamaz).
// Kullanıcı önizlemeyi onaylayınca /api/analyze çağrılır.
export async function POST(req: Request): Promise<NextResponse> {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Geçersiz istek." }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ ok: false, error: "İlan linki gerekli." }, { status: 400 });
  }

  try {
    const listing = await fetchListing(url);
    return NextResponse.json({
      ok: true,
      listing: {
        title: listing.title,
        description: listing.description,
        price: listing.price,
        asDescription: listing.asDescription,
        imageBase64: listing.imageBase64,
        mediaType: listing.mediaType,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Link okunamadı.";
    console.error("[preview-url] hata:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
