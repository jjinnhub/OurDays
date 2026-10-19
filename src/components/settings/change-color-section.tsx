"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ColorPalette } from "@/components/color-palette";
import { createClient } from "@/lib/supabase/client";

type Props = {
  familyId: string;
  currentColor: string;
  /** 다른 구성원이 사용 중인 색상 */
  usedColors: string[];
};

export function ChangeColorSection({ familyId, currentColor, usedColors }: Props) {
  const router = useRouter();
  const [color, setColor] = useState(currentColor);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = color !== currentColor;

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error: updateError } = await supabase
      .from("family_members")
      .update({ color })
      .eq("family_id", familyId)
      .eq("user_id", user.id);

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">내 색상</p>
      <ColorPalette value={color} onChange={setColor} usedColors={usedColors} />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button size="sm" onClick={save} disabled={!dirty || saving}>
        {saving && <Loader2 className="animate-spin" />}
        {saved && <Check />}
        {saved ? "저장됨" : "색상 저장"}
      </Button>
    </div>
  );
}
