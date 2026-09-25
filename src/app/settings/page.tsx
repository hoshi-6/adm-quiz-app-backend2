"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRef, useState } from "react";
import { Button, Card, ErrorNote, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { db, defaultSettings, exportAll, importAll, todayStr, type Settings } from "@/lib/db";
import { NUTRIENT_KEYS, NUTRIENTS, calcTargets, type ActivityLevel, type Sex } from "@/lib/nutrients";

export default function SettingsPage() {
  // undefined = 読み込み中、null = 未保存
  const stored = useLiveQuery(async () => (await db.settings.get("main")) ?? null, []);
  if (stored === undefined) return null;
  return <SettingsForm initial={stored ?? defaultSettings()} />;
}

function SettingsForm({ initial }: { initial: Settings }) {
  const [s, setS] = useState<Settings>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function save(next = s) {
    await db.settings.put(next);
    setMessage("保存しました");
    setTimeout(() => setMessage(null), 2000);
  }

  function updateProfile(patch: Partial<Settings["profile"]>) {
    const profile = { ...s.profile, ...patch };
    setS({ ...s, profile, targets: calcTargets(profile) });
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
    if (!confirm("現在のデータを上書きして復元します。よろしいですか？")) return;
    try {
      await importAll(JSON.parse(await file.text()));
      location.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function wipe() {
    if (!confirm("在庫・食事記録・設定をすべて削除します。元に戻せません。")) return;
    await db.delete();
    location.reload();
  }

  return (
    <>
      <PageHeader
        title="設定"
        action={
          <div className="flex items-center gap-2">
            {message && <span className="text-sm text-brand">{message}</span>}
            <Button onClick={() => save()}>保存</Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="プロフィール">
          <div className="grid grid-cols-3 gap-3">
            <Field label="性別">
              <Select value={s.profile.sex} onChange={(e) => updateProfile({ sex: e.target.value as Sex })}>
                <option value="female">女性</option>
                <option value="male">男性</option>
              </Select>
            </Field>
            <Field label="年齢">
              <Input type="number" min={18} max={100} value={s.profile.age} onChange={(e) => updateProfile({ age: Number(e.target.value) || 18 })} />
            </Field>
            <Field label="活動量">
              <Select value={s.profile.activity} onChange={(e) => updateProfile({ activity: e.target.value as ActivityLevel })}>
                <option value="low">低い</option>
                <option value="normal">ふつう</option>
                <option value="high">高い</option>
              </Select>
            </Field>
          </div>
          <p className="mt-3 text-xs text-muted">
            プロフィールを変えると、日本人の食事摂取基準（2025年版）をもとに目標値を再計算します。妊娠中・授乳中や持病がある場合は、医師・管理栄養士の指示に合わせて目標値を直接編集してください。
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

        <Card title="1日の目標値" className="md:col-span-2">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {NUTRIENT_KEYS.map((k) => (
              <Field key={k} label={`${NUTRIENTS[k].label}${NUTRIENTS[k].kind === "max" ? "（上限）" : ""} ${NUTRIENTS[k].unit}`}>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={s.targets[k]}
                  onChange={(e) => setS({ ...s, targets: { ...s.targets, [k]: Number(e.target.value) || 0 } })}
                />
              </Field>
            ))}
          </div>
        </Card>

        <Card title="データのバックアップ・移行">
          <p className="mb-3 text-sm text-muted">
            データはこの端末のブラウザ内に保存されています。スマホとPCで同じデータを使うときは、書き出したファイルをもう一方で読み込んでください。
          </p>
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
          <Field label="アクセス用パスコード（サーバーで APP_PASSCODE を設定した場合のみ）">
            <Input type="password" autoComplete="off" value={s.passcode} onChange={(e) => setS({ ...s, passcode: e.target.value })} />
          </Field>
          <Button variant="danger" className="mt-4 px-0" onClick={wipe}>
            すべてのデータを削除
          </Button>
        </Card>
      </div>
    </>
  );
}
