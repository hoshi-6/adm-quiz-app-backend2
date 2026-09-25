// 実在する市販品を検索する（Open Food Facts：誰でも使える世界の食品データベース）。
// 商品名での検索と、バーコード（JAN コード）での検索に対応する。
import { checkPasscode, errorResponse, HttpError } from "@/lib/server/http";

const BASE = process.env.OFF_BASE_URL || "https://world.openfoodfacts.org";
// Open Food Facts はアプリ名の User-Agent を付けることを求めている
const HEADERS = { "User-Agent": "gohan-navi/1.0 (personal nutrition app)" };
const FIELDS = "code,product_name,product_name_ja,brands,quantity";

export interface Product {
  code: string;
  name: string;
  brand: string;
  quantity: string;
}

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_ja?: string;
  brands?: string;
  quantity?: string;
}

function toProduct(p: OffProduct): Product | null {
  const name = (p.product_name_ja || p.product_name || "").trim();
  if (!name) return null;
  return {
    code: p.code ?? "",
    name,
    brand: (p.brands ?? "").split(",")[0].trim(),
    quantity: (p.quantity ?? "").trim(),
  };
}

async function off(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS, signal: AbortSignal.timeout(10_000), next: { revalidate: 86_400 } });
  if (!res.ok) throw new HttpError("商品データベースに接続できませんでした", 502);
  return res.json();
}

export async function GET(req: Request) {
  try {
    checkPasscode(req);
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    if (!q) return Response.json({ products: [] });
    if (q.length > 100) return Response.json({ error: "検索語が長すぎます" }, { status: 400 });

    let products: Product[];
    if (/^\d{8}$|^\d{12,14}$/.test(q)) {
      // バーコードの数字
      const data = await off(`/api/v2/product/${q}.json?fields=${FIELDS}`);
      products = data.status === 1 && data.product ? [toProduct({ code: q, ...data.product })].filter((p): p is Product => !!p) : [];
    } else {
      const params = new URLSearchParams({
        search_terms: q,
        search_simple: "1",
        action: "process",
        json: "1",
        page_size: "20",
        fields: FIELDS,
        tagtype_0: "countries",
        tag_contains_0: "contains",
        tag_0: "japan",
      });
      const data = await off(`/cgi/search.pl?${params}`);
      products = ((data.products ?? []) as OffProduct[]).map(toProduct).filter((p): p is Product => !!p);
    }
    return Response.json({ products });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "TypeError")) {
      return Response.json({ error: "商品データベースに接続できませんでした" }, { status: 502 });
    }
    return errorResponse(err);
  }
}
