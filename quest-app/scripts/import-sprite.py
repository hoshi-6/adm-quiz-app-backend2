"""ドット絵の画像（背景が透明な PNG）を 64×64 の主人公の絵として取り込む。

使い方: python3 scripts/import-sprite.py art/blackcoat.png BLACKCOAT src/lib/blackcoatSprite.ts
- キャラクターの範囲を切り出し、高さ 62 ドットに縮めて、足元を下にそろえて置く
- 色を最大 MAX_COLORS 色にまとめる
- 待機2コマ（上半身が1ドット沈む呼吸）と、踏み込む攻撃コマを作る
"""
import json
import sys

from PIL import Image, ImageFilter

N = 64
HEIGHT = 62
MAX_COLORS = 24
SHARPEN = 45  # 縮めたあとに輪郭をはっきりさせる強さ（%）
OUTLINE = "#08070a"
# 縮めると消えてしまう細部（目など）を描き足す: (x, y, 色)。64×64 の座標
TOUCHUPS = [(29, 15, "#3a3850"), (32, 15, "#3a3850")]  # 目（縮めると消えるので描き足す）
CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"


def load(path):
    im = Image.open(path).convert("RGBA")
    alpha = im.split()[3].point(lambda v: 255 if v > 128 else 0)
    im = im.crop(alpha.getbbox())
    w = max(1, round(im.width * HEIGHT / im.height))
    # 透明部分の色が混ざらないよう、色に不透明度を掛けてから縮める
    r, g, b, a = im.split()
    pre = Image.merge("RGBA", [Image.composite(c, Image.new("L", im.size, 0), a) for c in (r, g, b)] + [a])
    small = pre.resize((w, HEIGHT), Image.LANCZOS)
    return small


def to_grid(small):
    w, h = small.size
    # 不透明度で割り戻して元の色に戻し、輪郭をはっきりさせる
    rgb = Image.new("RGB", (w, h))
    alpha = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = small.getpixel((x, y))
            k = 255 / a if a else 0
            rgb.putpixel((x, y), (min(255, round(r * k)), min(255, round(g * k)), min(255, round(b * k))))
            alpha.append(a)
    if SHARPEN:
        rgb = rgb.filter(ImageFilter.UnsharpMask(radius=1, percent=SHARPEN, threshold=0))
    opaque = [((x, y), rgb.getpixel((x, y))) for y in range(h) for x in range(w) if alpha[y * w + x] >= 110]
    # 不透明な部分の色だけで減色する
    strip = Image.new("RGB", (len(opaque), 1))
    strip.putdata([c for _, c in opaque])
    q = strip.quantize(colors=MAX_COLORS, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()
    idx = list(q.get_flattened_data()) if hasattr(q, "get_flattened_data") else list(q.getdata())
    used = sorted(set(idx))
    key = {i: CHARS[n] for n, i in enumerate(used)}
    palette = {key[i]: "#%02x%02x%02x" % tuple(pal[i * 3 : i * 3 + 3]) for i in used}
    grid = [["."] * N for _ in range(N)]
    ox = (N - w) // 2
    oy = N - 1 - h  # 一番下の行は空ける（ほかのキャラと足元をそろえる）
    for ((x, y), _), i in zip(opaque, idx):
        grid[oy + y][ox + x] = key[i]
    # 外側に1ドットの輪郭（小さくしても形がはっきり見えるように）
    palette["k"] = OUTLINE
    edge = [(x, y) for y in range(N) for x in range(N) if grid[y][x] == "." and any(0 <= x + dx < N and 0 <= y + dy < N and grid[y + dy][x + dx] not in (".", "k") for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for x, y in edge:
        grid[y][x] = "k"
    for x, y, color in TOUCHUPS:
        ch = next((k for k, v in palette.items() if v == color), None)
        if ch is None:
            ch = next(c for c in CHARS if c not in palette)
            palette[ch] = color
        grid[y][x] = ch
    return grid, palette, oy


def shifted(grid, dx=0, dy=0, rows=None):
    """rows=(上端, 下端) の範囲だけ dx, dy ずらす（None なら全体）"""
    top, bottom = rows if rows else (0, N - 1)
    out = [r[:] for r in grid]
    for y in range(top, bottom + 1):
        out[y] = ["."] * N
    for y in range(top, bottom + 1):
        for x in range(N):
            c = grid[y][x]
            if c == ".":
                continue
            nx, ny = x + dx, y + dy
            if 0 <= nx < N and 0 <= ny < N:
                out[ny][nx] = c
    return out


def main():
    src, name, dest = sys.argv[1:4]
    grid, palette, top = load_and_grid(src)
    waist = top + int(HEIGHT * 0.5)
    frames = {
        "idle0": grid,
        "idle1": shifted(grid, 0, 1, (0, waist)),
        # 踏み込み：全体を少し前（絵の左＝戦闘で反転すると敵の方）へ、上半身はさらに前へ
        "attack": shifted(shifted(grid, -2, 0), -1, 0, (0, waist)),
    }
    rows = {k: ["".join(r) for r in g] for k, g in frames.items()}
    lines = [
        f"// 自動生成：scripts/import-sprite.py で {src} から作る（手で編集しない）",
        "import type { Sprite } from \"./sprites\";",
        "",
        f"export const {name}_PALETTE: Record<string, string> = {json.dumps(palette, indent=2)};",
        "",
        f"const frame = (rows: string[]): Sprite => ({{ rows, palette: {name}_PALETTE, hd: true }});",
        "",
        f"export const {name} = {{",
    ]
    for k in ("idle0", "idle1", "attack"):
        lines.append(f"  {k}: frame({json.dumps(rows[k], indent=2)}),")
    lines.append("};")
    open(dest, "w").write("\n".join(lines) + "\n")
    print(f"wrote {dest}: {len(palette)} colors")


def load_and_grid(src):
    return to_grid(load(src))


if __name__ == "__main__":
    main()
