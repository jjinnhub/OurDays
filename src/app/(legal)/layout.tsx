export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="container max-w-2xl py-10">
      <article className="space-y-4 text-sm leading-6">{children}</article>
    </main>
  );
}
