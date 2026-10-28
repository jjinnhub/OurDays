/* eslint-disable @typescript-eslint/no-explicit-any */
/** 카카오 지도 JS SDK 로더 — 스크립트를 한 번만 주입하고 로드 완료를 기다린다 */

declare global {
  interface Window {
    kakao: any;
  }
}

export function hasKakaoMapKey() {
  return Boolean(process.env.NEXT_PUBLIC_KAKAO_MAP_KEY);
}

let loader: Promise<any> | null = null;

export function loadKakaoMaps(): Promise<any> {
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("브라우저에서만 사용할 수 있어요."));
      return;
    }
    const appkey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
    if (!appkey) {
      reject(new Error("NEXT_PUBLIC_KAKAO_MAP_KEY가 설정되지 않았어요."));
      return;
    }
    if (window.kakao?.maps?.Map) {
      resolve(window.kakao);
      return;
    }
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appkey}&libraries=services&autoload=false`;
    script.async = true;
    script.onload = () => {
      window.kakao.maps.load(() => resolve(window.kakao));
    };
    script.onerror = () => {
      loader = null;
      reject(new Error("카카오 지도 스크립트를 불러오지 못했어요."));
    };
    document.head.appendChild(script);
  });
  return loader;
}
