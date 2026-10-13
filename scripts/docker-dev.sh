#!/bin/sh
# OurDays 개발 컨테이너 엔트리포인트
# node_modules는 named volume(리눅스 FS)에 있어 심볼릭 링크/rename이 정상 동작한다.
set -e
cd /app

STAMP=node_modules/.install-stamp
LOCK_HASH=$(md5sum package-lock.json | cut -d' ' -f1)

if [ ! -f "$STAMP" ] || [ "$(cat "$STAMP")" != "$LOCK_HASH" ]; then
  echo "[ourdays] package-lock.json 변경 감지 → npm ci 실행"
  npm ci
  echo "$LOCK_HASH" > "$STAMP"
else
  echo "[ourdays] 의존성 최신 상태, 설치 생략"
fi

export NEXT_DIST_DIR=build
echo "[ourdays] Next.js dev 서버 시작 (http://localhost:3000)"
export NEXT_TRACE_SPAN_THRESHOLD_MS=2147483647
exec node node_modules/next/dist/bin/next dev -H 0.0.0.0 -p 3000
