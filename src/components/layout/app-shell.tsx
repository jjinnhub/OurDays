"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  FolderOpen,
  Gift,
  Home,
  Landmark,
  MapPin,
  Menu,
  MessageCircle,
  Plane,
  Plus,
  ReceiptText,
  Settings,
  ShoppingCart,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { LogoutButton } from "@/components/auth/logout-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "소통",
    items: [{ href: "/messages", label: "메시지", icon: MessageCircle }],
  },
  {
    title: "가계",
    items: [
      { href: "/ledger", label: "가계부", icon: Wallet },
      { href: "/fixed-costs", label: "월 예산", icon: ReceiptText },
      { href: "/accounts", label: "자산", icon: Landmark },
    ],
  },
  {
    title: "일상",
    items: [
      { href: "/calendar", label: "캘린더", icon: CalendarDays },
      { href: "/trips", label: "여행", icon: Plane },
      { href: "/gifts", label: "축의금", icon: Gift },
      { href: "/shopping", label: "장바구니", icon: ShoppingCart },
      { href: "/meals", label: "식단표", icon: UtensilsCrossed },
      { href: "/places", label: "여기어때", icon: MapPin },
    ],
  },
  {
    title: "보관",
    items: [{ href: "/files", label: "파일함", icon: FolderOpen }],
  },
];

const MOBILE_TABS: NavItem[] = [
  { href: "/dashboard", label: "홈", icon: Home },
  { href: "/ledger", label: "가계부", icon: Wallet },
  { href: "/calendar", label: "캘린더", icon: CalendarDays },
  { href: "/more", label: "메뉴", icon: Menu },
];

type AppShellProps = {
  familyName: string;
  userName: string;
  color: string;
  children: React.ReactNode;
};

export function AppShell({ familyName, userName, color, children }: AppShellProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="min-h-dvh bg-background">
      {/* ---------- 데스크톱 사이드바 ---------- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-card md:flex">
        <Link href="/dashboard" className="flex items-center gap-2 px-5 py-4">
          <BrandLogo size={44} showWordmark={false} />
          <span className="text-lg font-bold text-brand-coral">OurDays</span>
        </Link>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          <Link
            href="/dashboard"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive("/dashboard")
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Home className="h-4 w-4" />
            대시보드
          </Link>

          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive(item.href)
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t px-3 py-3">
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive("/settings")
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Settings className="h-4 w-4" />
            설정
          </Link>
          <div className="mt-1 flex items-center justify-between px-3 py-1">
            <div className="flex items-center gap-2">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: color }}
              >
                {userName.slice(0, 1)}
              </span>
              <span className="text-sm font-medium">{userName}</span>
            </div>
            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* ---------- 상단 바 ---------- */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-card/80 px-4 backdrop-blur md:pl-64">
        <div className="flex items-center gap-2 md:hidden">
          <BrandLogo size={36} showWordmark={false} />
          <span className="font-bold text-brand-coral">OurDays</span>
        </div>
        <p className="hidden text-sm font-medium text-muted-foreground md:block">
          {familyName}
        </p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="알림" disabled>
            <Bell />
          </Button>
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white md:hidden"
            style={{ backgroundColor: color }}
          >
            {userName.slice(0, 1)}
          </span>
        </div>
      </header>

      {/* ---------- 본문 ---------- */}
      <main className="px-4 pb-24 pt-4 md:pb-8 md:pl-64 md:pr-6">
        <div className="w-full">{children}</div>
      </main>

      {/* ---------- 모바일 하단 탭 + 빠른 입력 ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="relative grid grid-cols-5 items-end">
          {MOBILE_TABS.slice(0, 2).map((tab) => (
            <MobileTab key={tab.href} tab={tab} active={isActive(tab.href)} />
          ))}
          {/* 가운데 ➕: 탭들과 같은 라인에 인라인 배치 */}
          <div className="flex justify-center self-center">
            <Link
              href="/ledger?add=1"
              aria-label="빠른 입력"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform active:scale-95"
            >
              <Plus className="h-6 w-6" />
            </Link>
          </div>
          {MOBILE_TABS.slice(2).map((tab) => (
            <MobileTab key={tab.href} tab={tab} active={isActive(tab.href)} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function MobileTab({ tab, active }: { tab: NavItem; active: boolean }) {
  return (
    <Link
      href={tab.href}
      className={cn(
        "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <tab.icon className="h-5 w-5" />
      {tab.label}
    </Link>
  );
}
