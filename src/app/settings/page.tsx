"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRef, useState } from "react";
import { Button, Card, ErrorNote, Field, OptionalNumberInput, PageHeader, Select, Textarea } from "@/components/ui";
import { clearLocal, db, defaultSettings, exportAll, importAll, saveSettings, todayStr, type Settings } from "@/lib/db";
import { forgetPasscode, syncNow, useSyncState } from "@/lib/sync";
import { DEFAULT_AGE, NUTRIENT_KEYS, NUTRIENTS, calcTargets, type ActivityLevel, type NutrientKey, type Profile, type Sex } from "@/lib/nutrients";
import { toast } from "@/lib/toast";

export default function SettingsPage() {
  // undefined = 読み込み中、null = 未保存
  const stored = useLiveQuery(async () => (await db.settings.get("main")) ?? null, []);
  if (stored === undefined) return null;
  // 他の端末で設定が変わったら、フォームを作り直して反映する
  return <SettingsForm key={stored?.updatedAt ?? 0} initial={stored ?? defaultSettings()} />;
}

/** 入力中の設定。数値の欄は空欄（null）にしておける */
type Draft = {
  profile: Omit<Profile, "age" | "weightKg"> & { age: number | null; weightKg: number | null };
  targets: Record<NutrientKey, number | null>;
  preferences: string;
};

const validAge = (age: number | null): age is number => age !== null && age >= 18 && age <= 120;

function toProfile(p: Draft["profile"]): Profile {
  return { ...p, age: validAge(p.age) ? p.age : DEFAULT_AGE, weightKg: p.weightKg && p.weightKg >= 20 && p.weightKg <= 300 ? p.weightKg : null };
}

function SettingsForm({ initial }: { initial: Settings }) {
  const initialDraft: Draft = {
    profile: { weightKg: null, menstruation: true, ...initial.profile },
    targets: initial.targets,
    preferences: initial.preferences,
  };
  const [s, setS] = useState<Draft>(initialDraft);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(s) !== JSON.stringify(initialDraft);

  const sync = useSyncState();
  const cloud = sync.status !== "local" && sync.status !== "starting";

  async function save() {
    setFormError(null);
    const { age, weightKg } = s.profile;
    if (age !== null && !validAge(age)) return setFormError("年齢は18〜120の数字で入力してください（空欄なら30歳で保存します）");
    if (weightKg !== null && (weightKg < 20 || weightKg > 300)) return setFormError("体重は20〜300kgの数字で入力してください（空欄でも保存できます）");

    // 空欄の項目は初期値で埋めて保存する
    const profile = toProfile(s.profile);
    const defaults = calcTargets(profile);
    const filled = NUTRIENT_KEYS.filter((k) => s.targets[k] === null);
    const targets = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, s.targets[k] ?? defaults[k]])) as Settings["targets"];
    await saveSettings({ profile, targets, preferences: s.preferences });

    const notes = [age === null && `年齢は${DEFAULT_AGE}歳`, filled.length > 0 && "空欄の目標値は基準値"].filter(Boolean);
    toast(notes.length ? `保存しました（${notes.join("、")}で保存）` : "設定を保存しました");
  }

  function updateProfile(patch: Partial<Draft["profile"]>) {
    const profile = { ...s.profile, ...patch };
    // 年齢が入力途中（空欄・範囲外）のうちは、目標値を計算し直さない
    setS({ ...s, profile, targets: validAge(profile.age) ? calcTargets(toProfile(profile)) : s.targets });
  }

  async function doExport() {
    const blob = new Blob([JSON.stringify(await exportAll(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gohan-navi-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function doImport(file: File) {
    setError(null);
    if (!confirm("バックアップの内容を取り込みます（同じ記録は上書き、それ以外は追加）。よろしいですか？")) return;
    try {
      await importAll(JSON.parse(await file.text()));
      toast("バックアップを取り込みました");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function wipe() {
    const text = cloud
      ? "この端末に保存されたデータを消して、クラウドから取り直します。まだ同期されていない変更は失われます。よろしいですか？"
      : "在庫・食事記録・設定をすべて削除します。元に戻せません。よろしいですか？";
    if (!confirm(text)) return;
    await clearLocal();
    location.reload();
  }

  async function logout() {
    if (!confirm("この端末からパスコードを削除します。再度使うにはパスコードの入力が必要です。")) return;
    await forgetPasscode();
  }

  return (
    <>
      <PageHeader
        title="設定"
        action={
          <div className="flex items-center gap-2">
            {dirty && <span className="text-xs text-warn">未保存の変更あり</span>}
            <Button onClick={() => save()}>保存</Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="プロフィール">
          <div className="grid grid-cols-2 gap-3">
            <Field label="性別">
              <Select value={s.profile.sex} onChange={(e) => updateProfile({ sex: e.target.value as Sex })}>
                <option value="female">女性</option>
                <option value="male">男性</option>
              </Select>
            </Field>
            <Field label="年齢（歳）">
              <OptionalNumberInput integer value={s.profile.age} placeholder={`空欄なら${DEFAULT_AGE}`} onValueChange={(age) => updateProfile({ age })} />
            </Field>
            <Field label="体重（kg・任意）">
              <OptionalNumberInput value={s.profile.weightKg} placeholder="例: 55" onValueChange={(weightKg) => updateProfile({ weightKg })} />
            </Field>
            <Field label="活動量" className="col-span-2">
              <Select value={s.profile.activity} onChange={(e) => updateProfile({ activity: e.target.value as ActivityLevel })}>
                <option value="low">低い（家にいることが多い）</option>
                <option value="normal">ふつう（通勤・通学・家事など）</option>
                <option value="high">高い（立ち仕事が多い・運動習慣がある）</option>
              </Select>
            </Field>
            {s.profile.sex === "female" && (s.profile.age ?? DEFAULT_AGE) < 65 && (
              <label className="col-span-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--brand)]"
                  checked={s.profile.menstruation ?? true}
                  onChange={(e) => updateProfile({ menstruation: e.target.checked })}
                />
                月経あり（鉄の目標値が変わります）
              </label>
            )}
          </div>
          <ErrorNote message={formError} />
          <p className="mt-3 text-xs text-muted">
            目標値は厚生労働省「日本人の食事摂取基準（2025年版）」の値で計算します。体重を入れると、公式の計算式（基礎代謝基準値 × 体重 × 身体活動レベル）で、あなたの体格に合わせたエネルギー量になります。妊娠中・授乳中や持病がある場合は、医師・管理栄養士の指示に合わせて目標値を直接編集してください。
          </p>
        </Card>

        <Card title="好み・アレルギー・苦手なもの">
          <Textarea
            rows={4}
            value={s.preferences}
            placeholder="例: えびアレルギー。パクチーは苦手。平日は20分以内で作りたい。"
            onChange={(e) => setS({ ...s, preferences: e.target.value })}
          />
          <p className="mt-2 text-xs text-muted">AIが献立を考えるときに必ず考慮します。</p>
        </Card>

        <Card
          title="1日の目標値"
          className="md:col-span-2"
          action={
            <button type="button" className="text-sm text-brand underline" onClick={() => setS({ ...s, targets: calcTargets(toProfile(s.profile)) })}>
              基準値で計算し直す
            </button>
          }
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {NUTRIENT_KEYS.map((k) => (
              <Field key={k} label={`${NUTRIENTS[k].label}${NUTRIENTS[k].kind === "max" ? "（上限）" : ""} ${NUTRIENTS[k].unit}`}>
                <OptionalNumberInput value={s.targets[k]} placeholder="空欄なら基準値" onValueChange={(v) => setS({ ...s, targets: { ...s.targets, [k]: v } })} />
              </Field>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            たんぱく質は「推奨量」と「目標量（エネルギー比。50歳以上は下限が14〜15%）の下限」の多い方、脂質・炭水化物は目標量（20〜30%・50〜65%）の中央値、食塩は目標量（未満）です。
          </p>
          <div className="mt-3 flex justify-end">
            <Button onClick={() => save()}>保存</Button>
          </div>
        </Card>

        <Card title="データの同期">
          {cloud ? (
            <>
              <p className="text-sm">
                クラウド同期：<span className="font-semibold text-brand">有効</span>
              </p>
              <p className="mt-1 text-sm text-muted">
                スマホ・PC など、同じパスコードを入れた端末どうしで在庫・食事記録・設定が自動で同期されます。
                {sync.lastSyncedAt && <>最終同期 {new Date(sync.lastSyncedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</>}
              </p>
              {sync.message && <p className="mt-2 text-sm text-danger">{sync.message}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => syncNow()} disabled={sync.status === "syncing"}>
                  {sync.status === "syncing" ? "同期中…" : "今すぐ同期"}
                </Button>
                <Button variant="ghost" onClick={logout}>
                  この端末からログアウト
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">
              クラウドが未設定のため、データはこの端末の中だけに保存されています。スマホとPCで同じデータを使うには、README の手順でデータベースを設定してください。
            </p>
          )}
        </Card>

        <Card title="バックアップ">
          <p className="mb-3 text-sm text-muted">データをファイルに書き出して保管したり、書き出したファイルを取り込んだりできます。</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={doExport}>
              書き出す
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              読み込む
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) doImport(f);
                e.target.value = "";
              }}
            />
          </div>
          <div className="mt-3">
            <ErrorNote message={error} />
          </div>
        </Card>

        <Card title="その他">
          <Button variant="danger" className="px-0" onClick={wipe}>
            {cloud ? "この端末のデータを削除して取り直す" : "すべてのデータを削除"}
          </Button>
        </Card>
      </div>
    </>
  );
}
