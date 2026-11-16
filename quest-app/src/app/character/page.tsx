"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { PixelSprite } from "@/components/PixelSprite";
import { Button, Window, cx, inputCls } from "@/components/ui";
import {
  type Avatar,
  DEFAULT_AVATAR,
  EYE_COLORS,
  HAIR_COLORS,
  HAIR_STYLES,
  OUTFITS,
  OUTFIT_COLORS,
  SKIN_COLORS,
  WEAPONS,
  PRESETS,
  type Preset,
  heroLook,
} from "@/lib/avatar";
import { setAvatar, useGame } from "@/lib/store";

const PASS_KEY = "level-quest:passcode";

export default function CharacterPage() {
  const game = useGame()!;
  return <Editor key={JSON.stringify(game.avatar ?? null)} initial={game.avatar ?? DEFAULT_AVATAR} name={game.playerName} />;
}

function Editor({ initial, name }: { initial: Avatar; name: string }) {
  const [a, setA] = useState<Avatar>(initial);
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "err" | "info" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [needPass, setNeedPass] = useState(false);
  const [pass, setPass] = useState(() => {
    try {
      return localStorage.getItem(PASS_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingFile = useRef<File | null>(null);
  const changed = JSON.stringify(a) !== JSON.stringify(initial);
  // 部品を選ぶと「組み立てた姿」に切り替わる
  const set = <K extends keyof Avatar>(k: K, v: Avatar[K]) => setA((x) => ({ ...x, [k]: v, preset: undefined }));
  const look = heroLook(a);
  const preset = a.preset;

  async function fromPhoto(file: File) {
    setBusy(true);
    setMsg({ text: "写真を読み取っています…（10〜30秒ほど）", tone: "info" });
    try {
      const { data, mediaType } = await shrink(file);
      const res = await fetch("/api/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: data, mediaType, passcode: pass || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401 && json.needPasscode) {
        pendingFile.current = file;
        setNeedPass(true);
        setMsg({ text: "合言葉（APP_PASSCODE）を入力してください。", tone: "info" });
        return;
      }
      if (!res.ok) throw new Error(json.error ?? `エラー（${res.status}）`);
      setA({ ...DEFAULT_AVATAR, ...json.avatar, preset: undefined });
      setNeedPass(false);
      try {
        if (pass) localStorage.setItem(PASS_KEY, pass);
      } catch {}
      setMsg({ text: `${json.comment ?? "キャラクターを作りました。"} 気になるところは下で直して「保存」を押してください。`, tone: "ok" });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "読み取りに失敗しました", tone: "err" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <Window title="主人公の姿" right={<Link href="/dungeon" className="text-xs text-muted underline">ダンジョンへ</Link>}>
        <div className="flex items-end gap-4">
          <div className="pixel-box grid h-52 w-40 shrink-0 place-items-center" style={{ background: "radial-gradient(ellipse at 50% 85%, #3a1a14, #0b0809 70%)" }}>
            <PixelSprite sprite={look.idle[0]} scale={preset ? 2.5 : 4} title="主人公のドット絵" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="truncate text-lg text-glow-strong glow-text">{name || "名もなき探索者"}</p>
            <p className="text-xs leading-relaxed text-muted">
              {preset
                ? `${PRESETS[preset].name}：${PRESETS[preset].desc}`
                : `${HAIR_COLORS[a.hairColor].name}髪の${HAIR_STYLES[a.hairStyle]}、${OUTFIT_COLORS[a.outfitColor].name}の${OUTFITS[a.outfit]}、${WEAPONS[a.weapon]}使い`}
            </p>
            <Button className="w-full" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? "読み取り中…" : "📷 写真から作る"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) fromPhoto(f);
              }}
            />
          </div>
        </div>
        {needPass && (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (pendingFile.current) fromPhoto(pendingFile.current);
            }}
          >
            <input className={inputCls} type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="合言葉" />
            <Button type="submit" className="shrink-0" disabled={!pass || busy}>
              送る
            </Button>
          </form>
        )}
        {msg && <p className={cx("mt-3 text-xs leading-relaxed", msg.tone === "ok" ? "text-ok" : msg.tone === "err" ? "text-danger" : "text-fg/80")}>{msg.text}</p>}
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          写真は AI（Claude）に送って髪型や色を読み取るためだけに使い、アプリにもサーバーにも保存しません。写真そのものが絵になるのではなく、近い部品が選ばれます。
        </p>
      </Window>

      <Window title="姿の種類">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            ...(Object.keys(PRESETS) as Preset[]).map((p) => ({
              key: p,
              on: preset === p,
              label: PRESETS[p].name,
              desc: "描きおろし 64×64・動きあり",
              sprite: heroLook({ ...a, preset: p }).idle[0],
              scale: 1,
              pick: () => setA({ ...a, preset: p }),
            })),
            {
              key: "parts",
              on: !preset,
              label: "自分で組み立てる",
              desc: "部品や写真から作る",
              sprite: heroLook({ ...a, preset: undefined }).idle[0],
              scale: 4 / 3,
              pick: () => setA({ ...a, preset: undefined }),
            },
          ].map((o) => (
            <button key={o.key} type="button" onClick={o.pick} aria-pressed={o.on} className={cx("pixel-box flex items-center gap-2 p-2 text-left", o.on && "bg-glow/20")}>
              <PixelSprite sprite={o.sprite} scale={o.scale} />
              <span className="min-w-0">
                <span className={cx("block text-sm", o.on ? "text-glow-strong" : "text-fg")}>{o.label}</span>
                <span className="block text-[10px] text-muted">{o.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </Window>

      <Window title="部品を選ぶ">
        {preset && <p className="mb-3 text-xs text-muted">部品を選ぶと「自分で組み立てる」に切り替わります。</p>}
        <div className="flex flex-col gap-4">
          <Choice label="髪型" options={HAIR_STYLES} value={a.hairStyle} onChange={(v) => set("hairStyle", v)} />
          <Swatches label="髪の色" options={HAIR_COLORS} value={a.hairColor} onChange={(v) => set("hairColor", v)} />
          <Swatches label="肌の色" options={SKIN_COLORS} value={a.skinColor} onChange={(v) => set("skinColor", v)} />
          <Swatches label="目の色" options={EYE_COLORS} value={a.eyeColor} onChange={(v) => set("eyeColor", v)} />
          <Choice label="服" options={OUTFITS} value={a.outfit} onChange={(v) => set("outfit", v)} />
          <Swatches label="服の色" options={OUTFIT_COLORS} value={a.outfitColor} onChange={(v) => set("outfitColor", v)} />
          <Choice label="武器" options={WEAPONS} value={a.weapon} onChange={(v) => set("weapon", v)} />
          <div className="flex gap-2">
            <Toggle label="眼鏡" on={a.glasses} onChange={(v) => set("glasses", v)} />
            <Toggle label="ひげ" on={a.beard} onChange={(v) => set("beard", v)} />
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <Button
            className="flex-1 py-2.5"
            disabled={!changed}
            onClick={() => {
              setAvatar(a);
              setMsg({ text: "保存しました。ダンジョンの主人公がこの姿になります。", tone: "ok" });
            }}
          >
            保存
          </Button>
          <Button variant="ghost" onClick={() => setA(DEFAULT_AVATAR)}>
            初期の姿
          </Button>
        </div>
      </Window>
    </div>
  );
}

function Choice<K extends string>({ label, options, value, onChange }: { label: string; options: Record<K, string>; value: K; onChange: (v: K) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(options) as K[]).map((k) => (
          <Button key={k} variant={value === k ? "primary" : "ghost"} className="px-2.5 py-1 text-xs" onClick={() => onChange(k)} aria-pressed={value === k}>
            {options[k]}
          </Button>
        ))}
      </div>
    </div>
  );
}

function Swatches<K extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Record<K, { name: string; hex: string }>;
  value: K;
  onChange: (v: K) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-muted">
        {label}：<span className="text-fg">{options[value].name}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(options) as K[]).map((k) => (
          <button
            key={k}
            type="button"
            title={options[k].name}
            aria-label={options[k].name}
            aria-pressed={value === k}
            onClick={() => onChange(k)}
            className={cx("h-8 w-8 border-2", value === k ? "border-glow-strong" : "border-black")}
            style={{ background: options[k].hex, boxShadow: value === k ? "0 0 0 2px #000, 0 0 8px rgba(230,194,122,.6)" : undefined }}
          />
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <Button variant={on ? "primary" : "ghost"} className="px-3 py-1.5 text-xs" onClick={() => onChange(!on)} aria-pressed={on}>
      {on ? "✔ " : ""}
      {label}
    </Button>
  );
}

/** 写真を長辺 768px の JPEG に縮めて base64 にする（送る量を減らす） */
async function shrink(file: File): Promise<{ data: string; mediaType: "image/jpeg" }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("この画像は読み込めませんでした"));
      i.src = url;
    });
    const s = Math.min(1, 768 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * s);
    c.height = Math.round(img.height * s);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return { data: c.toDataURL("image/jpeg", 0.85).split(",")[1], mediaType: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}
