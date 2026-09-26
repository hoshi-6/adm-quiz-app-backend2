"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ConsultReply, ConsultRequest, Suggestion } from "@/lib/ai/schemas";
import { daysUntil, type PantryItem } from "@/lib/db";
import { callApi } from "@/lib/hooks";
import { Button, ErrorNote, ProgressText, Textarea, cx } from "./ui";

/** 画面に出す会話。updated は AI がこの返事で献立を書き直したことを表す */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  updated?: boolean;
}

const QUICK = ["在庫にない材料を、家にあるもので代用したい", "材料を減らして簡単にしたい", "塩分を控えめにしたい", "この材料で合っているか確認したい"];

/** 選んだ献立について AI に相談する。材料を変える答えのときは、献立そのものも書き換える */
export function ConsultChat({
  suggestion,
  messages,
  onMessages,
  onUpdate,
  pantry,
  servings,
  mealType,
  preferences,
}: {
  suggestion: Suggestion;
  messages: ChatMessage[];
  onMessages: (m: ChatMessage[]) => void;
  onUpdate: (s: Suggestion) => void;
  pantry: PantryItem[];
  servings: number;
  mealType: string;
  preferences: string;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length) endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length, sending]);

  async function send(content: string) {
    content = content.trim();
    if (!content || sending) return;
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    onMessages(next);
    setText("");
    setSending(true);
    setError(null);
    try {
      const body: ConsultRequest = {
        mealType,
        servings,
        preferences,
        pantry: pantry.map((p) => ({
          name: p.name,
          category: p.category,
          quantity: p.quantity,
          unit: p.unit,
          daysLeft: p.expiresOn ? daysUntil(p.expiresOn) : null,
        })),
        suggestion,
        // 古い会話は切り詰める（献立は毎回いまのものを渡すので、流れがわかれば十分）
        messages: next.slice(-20).map(({ role, content }) => ({ role, content })),
      };
      const res = await callApi<ConsultReply>("/api/consult", body);
      onMessages([...next, { role: "assistant", content: res.reply, updated: !!res.updatedSuggestion }]);
      if (res.updatedSuggestion) onUpdate(res.updatedSuggestion);
    } catch (err) {
      setError((err as Error).message);
      // 送れなかった発言は入力欄に戻して、送り直せるようにする
      onMessages(messages);
      setText(content);
    } finally {
      setSending(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void send(text);
  }

  return (
    <div className="rounded-xl border border-line bg-bg/60 p-3">
      <p className="text-sm font-medium">この献立についてAIに相談</p>
      <p className="mb-3 text-xs text-muted">使う食材の代用・分量・作り方など、何でも聞けます。材料を変えると、上の献立（材料・作り方・栄養）も書き換わります。</p>

      {messages.length > 0 && (
        <ul className="mb-3 space-y-2" aria-label="相談の履歴">
          {messages.map((m, i) => (
            <li key={i} className={cx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cx(
                  "max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-relaxed",
                  m.role === "user" ? "rounded-br-sm bg-brand text-white" : "rounded-bl-sm border border-line bg-surface",
                )}
              >
                {m.content}
                {m.updated && <span className="mt-1.5 block text-xs font-medium text-brand">✓ 献立を書き換えました</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {sending && (
        <div className="mb-3">
          <ProgressText steps={["考えています…", "献立を見直しています…", "もう少しお待ちください…"]} interval={8000} />
        </div>
      )}
      <div ref={endRef} />

      {messages.length === 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              disabled={sending}
              onClick={() => void send(q)}
              className="rounded-full border border-line bg-surface px-3 py-1 text-left text-xs text-muted hover:border-brand hover:text-brand"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <ErrorNote message={error} />
      <form onSubmit={submit} className="mt-2 flex items-end gap-2">
        <Textarea
          rows={2}
          className="min-w-0 flex-1"
          value={text}
          placeholder="例: 鶏むね肉の代わりに豚こまでもいい？"
          aria-label="AIへの相談"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // PC は Enter で送信（Shift+Enter で改行）。変換中の Enter では送らない
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) {
              e.preventDefault();
              void send(text);
            }
          }}
        />
        <Button type="submit" disabled={sending || !text.trim()}>
          送信
        </Button>
      </form>
    </div>
  );
}
