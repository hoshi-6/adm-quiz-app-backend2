// 商品ページ（AI が参照した出典 URL）から、そのページの代表画像（og:image）の URL を取り出す。
// 画像 URL を AI に作らせると存在しない URL になることがあるため、実際のページから読み取る。
import { isIP } from "node:net";
import { checkPasscode, errorResponse } from "@/lib/server/http";

const MAX_BYTES = 1_500_000;

/** 社内ネットワークなどへのアクセスに使われないよう、公開サイトの https / http だけにする */
function isPublicUrl(u: URL) {
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".")) return false;
  if (isIP(host)) return false;
  return true;
}

function pickImage(html: string, base: URL): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*name=["']twitter:image(?::src)?["']/i,
    /<link[^>]+rel=["']image_src["'][^>]*href=["']([^"']+)["']/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (!m) continue;
    try {
      const url = new URL(m[1].replace(/&amp;/g, "&"), base);
      if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
    } catch {}
  }
  return null;
}

async function readLimited(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
    // og:image は <head> にあるので、</head> まで読めば十分
    if (new TextDecoder().decode(value).includes("</head>")) break;
  }
  reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export async function GET(req: Request) {
  try {
    checkPasscode(req);
    const raw = new URL(req.url).searchParams.get("url") ?? "";
    let target: URL;
    try {
      target = new URL(raw);
    } catch {
      return Response.json({ imageUrl: null });
    }
    if (!isPublicUrl(target)) return Response.json({ imageUrl: null });

    // リダイレクトは自分でたどり、行き先も毎回確かめる（最大3回）
    let res: Response | null = null;
    for (let hop = 0; hop < 4; hop++) {
      res = await fetch(target, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; gohan-navi/1.0)", Accept: "text/html" },
        signal: AbortSignal.timeout(6000),
        redirect: "manual",
        next: { revalidate: 86_400 },
      }).catch(() => null);
      const location = res && res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      if (!location) break;
      const next = new URL(location, target);
      if (!isPublicUrl(next)) return Response.json({ imageUrl: null });
      target = next;
      res = null;
    }
    if (!res?.ok || !(res.headers.get("content-type") ?? "").includes("html")) return Response.json({ imageUrl: null });
    const imageUrl = pickImage(await readLimited(res), target);
    return Response.json({ imageUrl });
  } catch (err) {
    return errorResponse(err);
  }
}
