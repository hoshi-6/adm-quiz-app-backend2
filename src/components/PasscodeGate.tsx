"use client";

import { useState, type FormEvent } from "react";
import { setPasscode, useSyncState } from "@/lib/sync";
import { Button, ErrorNote, Input, Spinner } from "./ui";

/** 初めて開いた端末で、クラウドのデータにアクセスするためのパスコードを入力してもらう */
export function PasscodeGate() {
  const sync = useSyncState();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!value) return;
    setBusy(true);
    await setPasscode(value);
    setBusy(false);
  }

  return (
    <div className="mx-auto mt-10 max-w-sm md:mt-24">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand text-2xl font-bold text-white">栄</span>
        <h1 className="text-xl font-bold">ごはんナビへようこそ</h1>
        <p className="mt-2 text-sm text-muted">パスコードを入力すると、ほかの端末と同じデータを使えます。</p>
      </div>
      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">パスコード</span>
          <Input type="password" autoComplete="current-password" autoFocus value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        <ErrorNote message={sync.message} />
        <Button type="submit" className="w-full" disabled={busy || !value}>
          {busy && <Spinner />}
          はじめる
        </Button>
      </form>
      <p className="mt-4 text-center text-xs text-muted">パスコードは、公開時に Vercel の環境変数 APP_PASSCODE に設定した文字列です。</p>
    </div>
  );
}
