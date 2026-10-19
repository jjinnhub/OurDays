"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: string;
  /** 라벨 앞 색상 점 (선택) */
  dot?: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** 버튼에 추가할 클래스 (크기 조절 등) */
  className?: string;
};

/** 네이티브 select 대신 쓰는 커스텀 드롭다운 — 입력창 폭에 맞는 흰 배경 목록 */
export function SelectBox({ value, onChange, options, placeholder = "선택", className }: Props) {
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 150);
        }}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-md border border-input bg-card px-3 py-2 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm",
          className,
        )}
      >
        <span className={cn("flex min-w-0 flex-1 items-center gap-2", !selected && "text-muted-foreground")}>
          {selected?.dot && (
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: selected.dot }}
            />
          )}
          <span className="truncate">{selected?.label ?? placeholder}</span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover shadow-md"
        >
          {options.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={value === option.value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-muted",
                  value === option.value && "font-semibold",
                )}
              >
                <span className="flex items-center gap-2">
                  {option.dot && (
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: option.dot }}
                    />
                  )}
                  {option.label}
                </span>
                {value === option.value && <Check className="h-4 w-4 text-primary" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
