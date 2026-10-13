"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, SearchX } from "lucide-react";

import { Input } from "@/components/ui/input";
import { DISPLAY_NAME_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (name: string) => void;
};

/** 검색 가능한 호칭 선택 드롭다운 */
export function DisplayNameSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = DISPLAY_NAME_OPTIONS.filter((o) =>
    o.includes(query.trim()),
  );

  function select(name: string) {
    onChange(name);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="relative">
        <Input
          role="combobox"
          aria-expanded={open}
          placeholder={value || "호칭 검색 또는 선택"}
          value={open ? query : value}
          onFocus={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
            setOpen(true);
            setQuery("");
          }}
          onBlur={() => {
            // 옵션 클릭(mousedown)이 먼저 처리되도록 지연 후 닫기
            blurTimer.current = setTimeout(() => setOpen(false), 150);
          }}
          onChange={(e) => setQuery(e.target.value)}
          className={cn("pr-9", value && !open && "font-medium")}
        />
        <ChevronDown
          className={cn(
            "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </div>

      {open && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md"
        >
          {filtered.length === 0 && (
            <li className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground">
              <SearchX className="h-4 w-4" />
              검색 결과가 없어요
            </li>
          )}
          {filtered.map((option) => (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={value === option}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(option);
                }}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-muted",
                  value === option && "font-semibold",
                )}
              >
                {option}
                {value === option && <Check className="h-4 w-4 text-primary" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
