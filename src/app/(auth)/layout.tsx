export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-10">
      {/* 로고 팔레트를 은은하게 깔아주는 배경 장식 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-blush/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-brand-sun/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-1/4 left-1/4 h-56 w-56 rounded-full bg-brand-sage/25 blur-3xl"
      />
      <div className="relative w-full">{children}</div>
    </div>
  );
}
