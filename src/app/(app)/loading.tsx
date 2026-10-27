/** 페이지 전환 중 콘텐츠 영역에 표시되는 스켈레톤 (사이드바·헤더는 유지됨) */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-label="불러오는 중">
      <div className="h-7 w-28 rounded-lg bg-muted" />
      <div className="h-24 rounded-xl bg-muted" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-44 rounded-xl bg-muted" />
        <div className="h-44 rounded-xl bg-muted" />
      </div>
      <div className="h-44 rounded-xl bg-muted" />
    </div>
  );
}
