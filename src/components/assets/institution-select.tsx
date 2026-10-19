"use client";

import { useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { INSTITUTIONS } from "@/lib/asset-constants";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

/** 은행/투자사 자동완성 — 직접 입력 가능, 제안 목록은 입력창 폭의 흰 배경 드롭다운 */
export function InstitutionSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = value.trim();
  const filtered = INSTITUTIONS.filter((i) => i.includes(query)).slice(0, 30);

  return (
    <div className="relative">
      <Input
        placeholder="예: 카카오뱅크 (직접 입력 가능)"
        maxLength={30}
        value={value}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 150);
        }}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover shadow-md"
        >
          {filtered.map((inst) => (
            <li key={inst}>
              <button
                type="button"
                role="option"
                aria-selected={value === inst}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(inst);
                  setOpen(false);
                }}
                className="w-full px-3 py-2.5 text-left text-sm hover:bg-muted"
              >
                {inst}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
