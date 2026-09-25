"use client";

import { useState } from "react";
import type { PantryCategory } from "@/lib/db";
import { searchFoods, type FoodEntry } from "@/lib/foods";
import { Input, cx } from "../ui";

/** 食材名の入力欄。打ち始めると、よく使う食材の候補を表示する */
export function FoodNameInput({
  value,
  onChange,
  onPick,
  category,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onPick: (food: FoodEntry) => void;
  category: PantryCategory;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const candidates = open ? searchFoods(value, category) : [];
  const exact = candidates.length === 1 && candidates[0].name === value;
  const show = candidates.length > 0 && !exact;

  function pick(f: FoodEntry) {
    onPick(f);
    setOpen(false);
    setActive(-1);
  }

  return (
    <div className="relative">
      <Input
        value={value}
        placeholder={placeholder}
        required
        autoComplete="off"
        role="combobox"
        aria-expanded={show}
        aria-controls="food-candidates"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        // 候補をタップする前に閉じないよう、少し待つ
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, candidates.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            pick(candidates[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {show && (
        <ul id="food-candidates" role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-xl border border-line bg-surface py-1 shadow-lg">
          {candidates.map((f, i) => (
            <li key={f.name} role="option" aria-selected={i === active}>
              <button
                type="button"
                className={cx("flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm", i === active ? "bg-subtle" : "hover:bg-subtle")}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(f)}
              >
                <span>{f.name}</span>
                <span className="text-xs text-muted">
                  {f.group}・{f.unit}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
