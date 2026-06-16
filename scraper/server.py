"""
crawl4ai tabanlı ilan scraper servisi.

Gerçek headless tarayıcı (Playwright/Chromium) ile sayfayı render eder; bu sayede
Akamai/DataDome gibi JS-challenge'ları çözebilir (düz HTTP fetch'in geçemediği yerler).

Çalıştırma:
    scraper/.venv/bin/uvicorn server:app --host 127.0.0.1 --port 8000
    (scraper/ klasöründen)

Next.js tarafı CRAWLER_URL=http://127.0.0.1:8000 ile buraya bağlanır.
"""

import re
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI
from pydantic import BaseModel
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

crawler: Optional[AsyncWebCrawler] = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global crawler
    browser_cfg = BrowserConfig(
        headless=True,
        viewport_width=1366,
        viewport_height=900,
        user_agent=UA,
    )
    crawler = AsyncWebCrawler(config=browser_cfg)
    await crawler.start()
    try:
        yield
    finally:
        await crawler.close()


app = FastAPI(lifespan=lifespan, title="BuNeKadarEder Scraper")


class ScrapeReq(BaseModel):
    url: str
    wait: Optional[float] = None  # render sonrası ek bekleme (saniye)


# "1.234 TL", "1.234,50 TL", "₺1.234", "12.500 ₺" gibi kalıpları yakalar
PRICE_RE = re.compile(
    r"(?:₺\s*)?\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})?\s*(?:tl|₺|lira)",
    re.IGNORECASE,
)


def extract_price(text: str) -> str:
    if not text:
        return ""
    m = PRICE_RE.search(text)
    return m.group(0).strip() if m else ""


def markdown_text(result) -> str:
    md = getattr(result, "markdown", None)
    if md is None:
        return getattr(result, "cleaned_html", "") or ""
    raw = getattr(md, "raw_markdown", None)
    return raw if isinstance(raw, str) else str(md)


@app.get("/health")
async def health():
    return {"ok": True}


@app.post("/scrape")
async def scrape(req: ScrapeReq):
    if crawler is None:
        return {"ok": False, "error": "crawler hazır değil"}

    cfg = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        magic=True,                 # anti-bot sezgileri (navigator.webdriver vb.)
        simulate_user=True,         # insan benzeri davranış
        override_navigator=True,
        scan_full_page=True,        # lazy-load görseller için kaydır
        delay_before_return_html=req.wait if req.wait is not None else 3.0,
        page_timeout=45000,
        wait_until="networkidle",
    )

    try:
        result = await crawler.arun(url=req.url, config=cfg)
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": f"crawl hata: {e}"}

    if not getattr(result, "success", False):
        return {"ok": False, "error": getattr(result, "error_message", None) or "crawl başarısız"}

    meta = result.metadata or {}
    title = (meta.get("og:title") or meta.get("title") or "").strip()
    description = (meta.get("og:description") or meta.get("description") or "").strip()

    # Görseller: og:image + sayfadaki görseller
    image_urls = []
    og_img = meta.get("og:image")
    if og_img:
        image_urls.append(og_img)
    media = getattr(result, "media", None) or {}
    for im in media.get("images", []) or []:
        src = (im.get("src") or "").strip()
        if src.startswith("http"):
            image_urls.append(src)
    seen, images = set(), []
    for s in image_urls:
        if s not in seen:
            seen.add(s)
            images.append(s)
    images = images[:5]

    price = extract_price(markdown_text(result))

    if not title and not description:
        html = getattr(result, "html", "") or ""
        if re.search(r"challenge validation|just a moment|captcha|are you a human", html, re.I):
            return {"ok": False, "error": "Bot koruması aşılamadı (challenge çözülemedi)."}
        return {"ok": False, "error": "Sayfadan ürün bilgisi okunamadı."}

    return {
        "ok": True,
        "title": title,
        "description": description,
        "price": price,
        "imageUrls": images,
    }
