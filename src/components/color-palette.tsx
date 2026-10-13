"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { MEMBER_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (color: string) => void;
  /** 다른 구성원이 이미 사용 중인 색상 (선택 불가 안내) */
  usedColors?: string[];
};

export function ColorPalette({ value, onChange, usedColors = [] }: Props) {
  const [warning, setWarning] = useState(false);

  function pick(color: string) {
    if (usedColors.includes(color)) {
      setWarning(true);
      return;
    }
    setWarning(false);
    onChange(color);
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-6 gap-2.5 sm:grid-cols-8">
        {MEMBER_COLORS.map((c) => {
          const used = usedColors.includes(c);
          const selected = value === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => pick(c)}
              aria-label={used ? `색상 ${c} (사용 중)` : `색상 ${c}`}
              className={cn(
                "relative flex h-9 w-9 items-center justify-center rounded-full transition-transform",
                selected && "scale-110 ring-2 ring-ring ring-offset-2 ring-offset-card",
                used && "opacity-35",
              )}
              style={{ backgroundColor: c }}
            >
              {selected && <Check className="h-4 w-4 text-white" />}
              {used && (
                <span className="absolute h-[2px] w-6 -rotate-45 rounded-full bg-white/90" />
              )}
            </button>
          );
        })}
      </div>
      {warning && (
        <p className="text-xs text-destructive">
          기존 구성원이 사용 중인 색상이에요. 다른 색상을 선택해 주세요.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        빗금 표시는 다른 구성원이 쓰고 있는 색상이에요.
      </p>
    </div>
  );
}
