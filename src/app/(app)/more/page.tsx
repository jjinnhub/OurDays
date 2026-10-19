import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronRight,
  FolderOpen,
  MessageCircle,
  Gift,
  Landmark,
  Plane,
  ReceiptText,
  Settings,
} from "lucide-react";

export const metadata: Metadata = { title: "메뉴" };

const ITEMS = [
  { href: "/messages", label: "메시지", icon: MessageCircle },
  { href: "/fixed-costs", label: "월 예산", icon: ReceiptText },
  { href: "/accounts", label: "자산", icon: Landmark },
  { href: "/trips", label: "여행", icon: Plane },
  { href: "/gifts", label: "축의금", icon: Gift },
  { href: "/files", label: "파일함", icon: FolderOpen },
  { href: "/settings", label: "설정", icon: Settings },
];

export default function MorePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">메뉴</h1>
      <ul className="divide-y rounded-xl border bg-card">
        {ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex items-center justify-between px-4 py-3.5 text-sm font-medium"
            >
              <span className="flex items-center gap-3">
                <item.icon className="h-5 w-5 text-muted-foreground" />
                {item.label}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
