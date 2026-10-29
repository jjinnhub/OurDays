"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MapPin,
  Navigation,
  Pencil,
  Plus,
  Search,
  Tags,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import type { FamilyMemberLite } from "@/lib/asset-constants";
import { chipTextColor } from "@/lib/calendar-constants";
import { hasKakaoMapKey, loadKakaoMaps } from "@/lib/kakao-maps";
import {
  DEFAULT_CENTER,
  KAKAO_GROUP_TO_CATEGORY,
  PLACE_STATUSES,
  PLACE_STATUS_MAP,
  kakaoDirectionsUrl,
  placeCategoryLabel,
  searchCategoryLabel,
  type KakaoSearchResult,
  type Place,
  type PlaceCategory,
  type PlaceStatusKey,
} from "@/lib/place-constants";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Props = {
  familyId: string;
  initialCategories: PlaceCategory[];
  initialPlaces: Place[];
  members: FamilyMemberLite[];
  canEdit: boolean;
};

/** 페이지 번호 목록 — 많아지면 현재 페이지 주변과 양끝만 남기고 …으로 줄인다. */
function buildPages(current: number, total: number) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const lo = Math.max(2, current - 1);
  const hi = Math.min(total - 1, current + 1);
  const out: (number | "gap-l" | "gap-r")[] = [1];
  if (lo > 2) out.push("gap-l");
  for (let p = lo; p <= hi; p++) out.push(p);
  if (hi < total - 1) out.push("gap-r");
  out.push(total);
  return out;
}

export function PlacesView({
  familyId,
  initialCategories,
  initialPlaces,
  members,
  canEdit,
}: Props) {
  const [categories, setCategories] = useState(initialCategories);
  const [places, setPlaces] = useState(initialPlaces);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<PlaceStatusKey | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 지도
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const kakaoRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapEnabled = hasKakaoMapKey();

  // 장소 추가/수정 모달
  const [formOpen, setFormOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KakaoSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [picked, setPicked] = useState<KakaoSearchResult | null>(null);
  const [formName, setFormName] = useState("");
  const [formCategoryId, setFormCategoryId] = useState<string | null>(null);
  const [formStatus, setFormStatus] = useState<PlaceStatusKey>("wish");
  const [formMemo, setFormMemo] = useState("");

  // 상세 모달 삭제 확인
  const [confirmDelete, setConfirmDelete] = useState(false);

  // 지도 위 검색 + 클릭 지점 미리보기
  const [mapQuery, setMapQuery] = useState("");
  const [mapResults, setMapResults] = useState<KakaoSearchResult[]>([]);
  const [mapSearched, setMapSearched] = useState(false);
  const [preview, setPreview] = useState<{
    name: string;
    address: string;
    lat: number;
    lng: number;
    raw: KakaoSearchResult | null;
  } | null>(null);
  const previewOverlayRef = useRef<any>(null);

  // 카테고리 관리 모달
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<PlaceCategory | "new" | null>(null);
  const [catName, setCatName] = useState("");
  const [catIcon, setCatIcon] = useState("📍");
  const [catConfirmDelete, setCatConfirmDelete] = useState(false);

  const catById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const memberById = useMemo(
    () => new Map(members.map((m) => [m.user_id, m])),
    [members],
  );
  const sortedCategories = useMemo(
    () =>
      [...categories].sort(
        (a, b) =>
          a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
      ),
    [categories],
  );
  const filteredPlaces = useMemo(
    () =>
      places.filter(
        (p) =>
          (categoryFilter === null || p.category_id === categoryFilter) &&
          (statusFilter === null || p.status === statusFilter),
      ),
    [places, categoryFilter, statusFilter],
  );
  const selectedPlace = selectedId
    ? (places.find((p) => p.id === selectedId) ?? null)
    : null;

  // 2차 필터 — 1차 필터 결과에 존재하는 카카오 카테고리 라벨 (지도 왼쪽 아래 칩)
  const [kakaoFilter, setKakaoFilter] = useState<string | null>(null);
  const kakaoCategories = useMemo(() => {
    const set = new Set<string>();
    for (const p of filteredPlaces) {
      if (p.kakao_category) set.add(p.kakao_category);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "ko"));
  }, [filteredPlaces]);

  useEffect(() => {
    setKakaoFilter(null);
  }, [categoryFilter, statusFilter]);

  useEffect(() => {
    if (kakaoFilter && !kakaoCategories.includes(kakaoFilter)) {
      setKakaoFilter(null);
    }
  }, [kakaoFilter, kakaoCategories]);

  const visiblePlaces = useMemo(
    () =>
      kakaoFilter
        ? filteredPlaces.filter((p) => p.kakao_category === kakaoFilter)
        : filteredPlaces,
    [filteredPlaces, kakaoFilter],
  );

  // 장소 리스트 페이지네이션 — 데스크톱 15개(5열×3줄) / 모바일 10개
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setPageSize(mq.matches ? 15 : 10);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [categoryFilter, statusFilter, kakaoFilter, pageSize]);

  const pageCount = Math.max(1, Math.ceil(visiblePlaces.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pagedPlaces = useMemo(
    () => visiblePlaces.slice((safePage - 1) * pageSize, safePage * pageSize),
    [visiblePlaces, safePage, pageSize],
  );

  // ---------- 기본 카테고리 시드 ----------
  useEffect(() => {
    if (!canEdit || initialCategories.length > 0) return;
    const supabase = createClient();
    void supabase
      .rpc("ensure_place_categories", { p_family_id: familyId })
      .then(({ data }) => {
        if (data) setCategories(data as PlaceCategory[]);
      });
  }, [canEdit, familyId, initialCategories.length]);

  // ---------- 지도 초기화 ----------
  useEffect(() => {
    if (!mapEnabled || mapRef.current) return;
    let cancelled = false;
    loadKakaoMaps()
      .then((kakao) => {
        if (cancelled || !mapDivRef.current) return;
        kakaoRef.current = kakao;
        const map = new kakao.maps.Map(mapDivRef.current, {
          center: new kakao.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
          level: 7,
        });
        if (initialPlaces.length > 0) {
          const bounds = new kakao.maps.LatLngBounds();
          for (const p of initialPlaces) {
            bounds.extend(new kakao.maps.LatLng(p.lat, p.lng));
          }
          map.setBounds(bounds, 40);
        }
        // 지도 빈 곳 클릭 → 주소 역지오코딩해서 하단 미리보기 카드 표시
        const geocoder = new kakao.maps.services.Geocoder();
        kakao.maps.event.addListener(map, "click", (e: any) => {
          const lat = e.latLng.getLat();
          const lng = e.latLng.getLng();
          geocoder.coord2Address(lng, lat, (res: any[], status: string) => {
            const addr =
              status === kakao.maps.services.Status.OK && res[0]
                ? (res[0].road_address?.address_name ??
                  res[0].address?.address_name ??
                  "")
                : "";
            setPreview({ name: "", address: addr, lat, lng, raw: null });
          });
        });
        mapRef.current = map;
        setMapReady(true);
      })
      .catch((e: Error) => {
        if (!cancelled) setMapError(e.message);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapEnabled]);

  // ---------- 마커 렌더링 ----------
  useEffect(() => {
    if (!mapReady) return;
    const kakao = kakaoRef.current;
    const map = mapRef.current;
    for (const o of overlaysRef.current) o.setMap(null);
    overlaysRef.current = [];

    for (const place of visiblePlaces) {
      const status = PLACE_STATUS_MAP[place.status];
      const icon = place.category_id
        ? (catById.get(place.category_id)?.icon ?? "📍")
        : "📍";

      const el = document.createElement("button");
      el.type = "button";
      el.style.cssText =
        "display:flex;flex-direction:column;align-items:center;background:none;border:none;padding:0;cursor:pointer;";
      const pin = document.createElement("span");
      pin.textContent = icon;
      pin.style.cssText = `display:flex;align-items:center;justify-content:center;height:34px;width:34px;border-radius:9999px;background:${status.color};border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.35);font-size:16px;`;
      const label = document.createElement("span");
      label.textContent =
        place.name.length > 10 ? `${place.name.slice(0, 10)}…` : place.name;
      label.style.cssText =
        "margin-top:2px;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:#fff;color:#44403a;font-size:11px;font-weight:600;padding:1px 7px;border-radius:9999px;box-shadow:0 1px 3px rgba(0,0,0,.25);";
      el.appendChild(pin);
      el.appendChild(label);
      el.addEventListener("click", () => {
        setSelectedId(place.id);
        setConfirmDelete(false);
      });

      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(place.lat, place.lng),
        content: el,
        yAnchor: 0.5,
        clickable: true,
      });
      overlay.setMap(map);
      overlaysRef.current.push(overlay);
    }
  }, [mapReady, visiblePlaces, catById]);

  // 미리보기(검색 선택·지도 클릭) 지점 마커 표시 + 이동
  useEffect(() => {
    if (!mapReady) return;
    const kakao = kakaoRef.current;
    if (previewOverlayRef.current) {
      previewOverlayRef.current.setMap(null);
      previewOverlayRef.current = null;
    }
    if (!preview) return;
    const el = document.createElement("div");
    el.style.cssText =
      "height:18px;width:18px;border-radius:9999px;background:#E8645B;border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.4);";
    const overlay = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(preview.lat, preview.lng),
      content: el,
      yAnchor: 0.5,
    });
    overlay.setMap(mapRef.current);
    previewOverlayRef.current = overlay;
    mapRef.current.panTo(new kakao.maps.LatLng(preview.lat, preview.lng));
  }, [mapReady, preview]);

  // 상세로 선택된 장소로 지도 이동
  useEffect(() => {
    if (!mapReady || !selectedPlace) return;
    const kakao = kakaoRef.current;
    mapRef.current.panTo(new kakao.maps.LatLng(selectedPlace.lat, selectedPlace.lng));
  }, [mapReady, selectedPlace]);

  // ---------- 장소 검색 ----------
  const runSearch = useCallback(() => {
    const q = query.trim();
    if (!q || !kakaoRef.current) return;
    const kakao = kakaoRef.current;
    const svc = new kakao.maps.services.Places();
    svc.keywordSearch(q, (data: KakaoSearchResult[], status: string) => {
      setSearched(true);
      setResults(status === kakao.maps.services.Status.OK ? data.slice(0, 8) : []);
    });
  }, [query]);

  function runMapSearch() {
    const q = mapQuery.trim();
    if (!q || !kakaoRef.current) return;
    const kakao = kakaoRef.current;
    const svc = new kakao.maps.services.Places();
    svc.keywordSearch(q, (data: KakaoSearchResult[], status: string) => {
      setMapSearched(true);
      setMapResults(
        status === kakao.maps.services.Status.OK ? data.slice(0, 8) : [],
      );
    });
  }

  function pickMapResult(r: KakaoSearchResult) {
    setPreview({
      name: r.place_name,
      address: r.road_address_name || r.address_name,
      lat: Number(r.y),
      lng: Number(r.x),
      raw: r,
    });
    setMapResults([]);
    setMapSearched(false);
  }

  function openCreateFromPreview() {
    if (!preview) return;
    const r: KakaoSearchResult =
      preview.raw ?? {
        id: "",
        place_name: "",
        address_name: preview.address,
        road_address_name: "",
        x: String(preview.lng),
        y: String(preview.lat),
        category_group_code: "",
        category_name: "",
        place_url: "",
      };
    setEditingPlace(null);
    setQuery("");
    setResults([]);
    setSearched(false);
    setFormCategoryId(sortedCategories[0]?.id ?? null);
    setFormStatus("wish");
    setFormMemo("");
    pickResult(r);
    setFormOpen(true);
  }

  function pickResult(r: KakaoSearchResult) {
    setPicked(r);
    setFormName(r.place_name);
    const guessName = KAKAO_GROUP_TO_CATEGORY[r.category_group_code];
    if (guessName) {
      const match = categories.find((c) => c.name === guessName);
      if (match) setFormCategoryId(match.id);
    }
  }

  // ---------- 장소 추가/수정 ----------
  function openCreate() {
    setEditingPlace(null);
    setQuery("");
    setResults([]);
    setSearched(false);
    setPicked(null);
    setFormName("");
    setFormCategoryId(sortedCategories[0]?.id ?? null);
    setFormStatus("wish");
    setFormMemo("");
    setFormOpen(true);
  }

  function openEdit(place: Place) {
    setEditingPlace(place);
    setPicked(null);
    setFormName(place.name);
    setFormCategoryId(place.category_id);
    setFormStatus(place.status);
    setFormMemo(place.memo);
    setSelectedId(null);
    setFormOpen(true);
  }

  async function savePlace() {
    const name = formName.trim();
    if (!name || saving) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    if (editingPlace) {
      const next = {
        name,
        category_id: formCategoryId,
        status: formStatus,
        memo: formMemo.trim(),
      };
      const { error } = await supabase
        .from("places")
        .update(next)
        .eq("id", editingPlace.id);
      if (error) setError("장소를 수정하지 못했어요.");
      else {
        setPlaces((prev) =>
          prev.map((p) => (p.id === editingPlace.id ? { ...p, ...next } : p)),
        );
        setFormOpen(false);
      }
    } else {
      if (!picked) {
        setSaving(false);
        return;
      }
      const { data, error } = await supabase
        .from("places")
        .insert({
          family_id: familyId,
          category_id: formCategoryId,
          name,
          address: picked.road_address_name || picked.address_name,
          lat: Number(picked.y),
          lng: Number(picked.x),
          status: formStatus,
          memo: formMemo.trim(),
          kakao_place_id: picked.id,
          kakao_url: picked.place_url,
          kakao_category: placeCategoryLabel(picked),
        })
        .select()
        .single();
      if (error || !data) setError("장소를 추가하지 못했어요.");
      else {
        const place = data as Place;
        setPlaces((prev) => [place, ...prev]);
        setFormOpen(false);
        setPreview(null);
        if (mapReady) {
          const kakao = kakaoRef.current;
          mapRef.current.panTo(new kakao.maps.LatLng(place.lat, place.lng));
        }
      }
    }
    setSaving(false);
  }

  async function deletePlace() {
    if (!selectedPlace || saving) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("places")
      .delete()
      .eq("id", selectedPlace.id);
    if (error) setError("장소를 삭제하지 못했어요.");
    else {
      setPlaces((prev) => prev.filter((p) => p.id !== selectedPlace.id));
      setSelectedId(null);
    }
    setSaving(false);
  }

  async function markVisited(status: Exclude<PlaceStatusKey, "wish">) {
    if (!selectedPlace || saving) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("places")
      .update({ status })
      .eq("id", selectedPlace.id);
    if (error) setError("상태를 바꾸지 못했어요.");
    else {
      setPlaces((prev) =>
        prev.map((p) => (p.id === selectedPlace.id ? { ...p, status } : p)),
      );
    }
    setSaving(false);
  }

  // ---------- 카테고리 관리 ----------
  function openCatEdit(cat: PlaceCategory | "new") {
    setEditingCat(cat);
    setCatName(cat === "new" ? "" : cat.name);
    setCatIcon(cat === "new" ? "📍" : cat.icon);
    setCatConfirmDelete(false);
  }

  async function saveCategory() {
    if (editingCat === null || saving) return;
    const name = catName.trim();
    const icon = catIcon.trim() || "📍";
    if (!name) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    if (editingCat === "new") {
      const maxOrder = categories.reduce((m, c) => Math.max(m, c.sort_order), -1);
      const { data, error } = await supabase
        .from("place_categories")
        .insert({ family_id: familyId, name, icon, sort_order: maxOrder + 1 })
        .select()
        .single();
      if (error || !data) setError("카테고리를 추가하지 못했어요.");
      else {
        setCategories((prev) => [...prev, data as PlaceCategory]);
        setEditingCat(null);
      }
    } else {
      const { error } = await supabase
        .from("place_categories")
        .update({ name, icon })
        .eq("id", editingCat.id);
      if (error) setError("카테고리를 수정하지 못했어요.");
      else {
        setCategories((prev) =>
          prev.map((c) => (c.id === editingCat.id ? { ...c, name, icon } : c)),
        );
        setEditingCat(null);
      }
    }
    setSaving(false);
  }

  async function deleteCategory() {
    if (editingCat === null || editingCat === "new" || saving) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("place_categories")
      .delete()
      .eq("id", editingCat.id);
    if (error) setError("카테고리를 삭제하지 못했어요.");
    else {
      setCategories((prev) => prev.filter((c) => c.id !== editingCat.id));
      setPlaces((prev) =>
        prev.map((p) =>
          p.category_id === editingCat.id ? { ...p, category_id: null } : p,
        ),
      );
      if (categoryFilter === editingCat.id) setCategoryFilter(null);
      setEditingCat(null);
    }
    setSaving(false);
  }

  function StatusBadge({ status }: { status: PlaceStatusKey }) {
    const s = PLACE_STATUS_MAP[status];
    return (
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
        style={{ backgroundColor: `${s.color}2E`, color: chipTextColor(s.color) }}
      >
        {s.label}
      </span>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">여기어때</h1>
        {canEdit && (
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setCatModalOpen(true)}>
              <Tags />
              카테고리
            </Button>
            <Button size="sm" onClick={openCreate} disabled={!mapEnabled}>
              <Plus />
              장소 추가
            </Button>
          </div>
        )}
      </header>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* ---------- 필터 ---------- */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategoryFilter(null)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium",
              categoryFilter === null
                ? "border-primary bg-primary/10"
                : "bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            전체
          </button>
          {sortedCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() =>
                setCategoryFilter((prev) => (prev === cat.id ? null : cat.id))
              }
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium",
                categoryFilter === cat.id
                  ? "border-primary bg-primary/10"
                  : "bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setStatusFilter(null)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium",
              statusFilter === null
                ? "border-primary bg-primary/10"
                : "bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            전체
          </button>
          {PLACE_STATUSES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() =>
                setStatusFilter((prev) => (prev === s.key ? null : s.key))
              }
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                statusFilter === s.key
                  ? "border-primary bg-primary/10"
                  : "bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---------- 지도 ---------- */}
      {!mapEnabled ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <MapPin className="h-7 w-7" />
            </span>
            <div>
              <p className="font-semibold">카카오 지도 키가 설정되지 않았어요</p>
              <p className="text-sm text-muted-foreground">
                환경 변수 NEXT_PUBLIC_KAKAO_MAP_KEY에 카카오 JavaScript 키를
                넣으면 지도가 표시돼요.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          <div
            ref={mapDivRef}
            className="h-[340px] w-full rounded-xl border md:h-[640px]"
          />

          {/* 지도 위 검색창 */}
          {!mapError && (
            <div className="absolute left-2 right-2 top-2 z-10 sm:right-auto sm:w-80">
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="장소 검색"
                    className="h-9 bg-card/95 pl-9 shadow-md backdrop-blur"
                    value={mapQuery}
                    onChange={(e) => {
                      setMapQuery(e.target.value);
                      setMapSearched(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        runMapSearch();
                      }
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 bg-card/95 shadow-md backdrop-blur"
                  onClick={runMapSearch}
                >
                  검색
                </Button>
              </div>
              {mapResults.length > 0 && (
                <ul className="mt-1 max-h-56 divide-y overflow-y-auto rounded-lg border bg-card shadow-lg">
                  {mapResults.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => pickMapResult(r)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/40"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-sm font-medium">
                            <span className="truncate">{r.place_name}</span>
                            {r.category_name && (
                              <span className="shrink-0 text-xs font-normal text-muted-foreground">
                                {searchCategoryLabel(r.category_name)}
                              </span>
                            )}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {r.road_address_name || r.address_name}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {mapSearched && mapResults.length === 0 && (
                <p className="mt-1 rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground shadow-lg">
                  검색 결과가 없어요.
                </p>
              )}
            </div>
          )}

          {/* 검색 선택·지도 클릭 지점 미리보기 카드 */}
          {preview && !mapError && (
            <div className="absolute inset-x-2 bottom-2 z-10 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {preview.name || "선택한 위치"}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {preview.address ||
                      `${preview.lat.toFixed(5)}, ${preview.lng.toFixed(5)}`}
                  </span>
                </span>
                {canEdit && (
                  <Button size="sm" onClick={openCreateFromPreview}>
                    <Plus />
                    등록
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                  aria-label="닫기"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-muted/60 text-sm text-muted-foreground">
              {mapError}
            </div>
          )}
        </div>
      )}

      {/* ---------- 2차 필터 — 1차 결과의 카카오 카테고리 라벨 (지도와 카드 사이) ---------- */}
      {kakaoCategories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setKakaoFilter(null)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium",
              kakaoFilter === null
                ? "border-primary bg-primary/10"
                : "bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            전체
          </button>
          {kakaoCategories.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() =>
                setKakaoFilter((prev) => (prev === label ? null : label))
              }
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium",
                kakaoFilter === label
                  ? "border-primary bg-primary/10"
                  : "bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ---------- 장소 리스트 ---------- */}
      {visiblePlaces.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {places.length === 0
              ? "아직 등록된 장소가 없어요. 가보고 싶은 곳을 추가해 보세요."
              : "조건에 맞는 장소가 없어요."}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid auto-rows-fr gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {pagedPlaces.map((place) => {
            const cat = place.category_id ? catById.get(place.category_id) : null;
            const owner = memberById.get(place.created_by);
            return (
              <button
                key={place.id}
                type="button"
                onClick={() => {
                  setSelectedId(place.id);
                  setConfirmDelete(false);
                }}
                className="rounded-xl border bg-card p-3.5 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/40"
              >
                <div className="flex items-center gap-1.5">
                  <span className="shrink-0">{cat?.icon ?? "📍"}</span>
                  <span className="truncate text-sm font-semibold">
                    {place.name}
                  </span>
                  {place.kakao_category && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {place.kakao_category}
                    </span>
                  )}
                  <StatusBadge status={place.status} />
                </div>
                {place.address && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {place.address}
                  </p>
                )}
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted-foreground">
                    {place.memo}
                  </span>
                  {owner && (
                    <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: owner.color }}
                      />
                      {owner.display_name}
                    </span>
                  )}
                </div>
              </button>
              );
            })}
            {/* 마지막 페이지 등에서 그리드 높이가 줄지 않도록 빈 칸을 채워 페이지 바 위치 고정 */}
            {pageCount > 1 &&
              Array.from({ length: pageSize - pagedPlaces.length }, (_, i) => (
                <div
                  key={`placeholder-${i}`}
                  aria-hidden
                  className="invisible rounded-xl border p-3.5"
                />
              ))}
          </div>
          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-1 pt-1">
              <button
                type="button"
                disabled={safePage === 1}
                onClick={() => setPage(safePage - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border bg-card text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-card"
                aria-label="이전 페이지"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {buildPages(safePage, pageCount).map((p) =>
                typeof p === "number" ? (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={cn(
                      "h-8 min-w-8 rounded-lg px-1.5 text-sm font-medium",
                      p === safePage
                        ? "bg-primary text-primary-foreground"
                        : "border bg-card text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {p}
                  </button>
                ) : (
                  <span key={p} className="px-1 text-sm text-muted-foreground">
                    …
                  </span>
                ),
              )}
              <button
                type="button"
                disabled={safePage === pageCount}
                onClick={() => setPage(safePage + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border bg-card text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-card"
                aria-label="다음 페이지"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* ---------- 장소 상세 모달 ---------- */}
      <Modal
        open={selectedPlace !== null}
        onClose={() => setSelectedId(null)}
        title={selectedPlace?.name ?? ""}
      >
        {selectedPlace && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>
                {selectedPlace.category_id
                  ? `${catById.get(selectedPlace.category_id)?.icon ?? "📍"} ${
                      catById.get(selectedPlace.category_id)?.name ?? "미분류"
                    }`
                  : "📍 미분류"}
              </span>
              <StatusBadge status={selectedPlace.status} />
              {memberById.get(selectedPlace.created_by) && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: memberById.get(selectedPlace.created_by)!
                        .color,
                    }}
                  />
                  {memberById.get(selectedPlace.created_by)!.display_name} 등록
                </span>
              )}
            </div>
            {selectedPlace.address && (
              <p className="text-sm text-muted-foreground">
                {selectedPlace.address}
              </p>
            )}
            {selectedPlace.memo && (
              <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                {selectedPlace.memo}
              </p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" asChild>
                <a
                  href={kakaoDirectionsUrl(
                    selectedPlace.name,
                    selectedPlace.lat,
                    selectedPlace.lng,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Navigation />
                  길찾기
                </a>
              </Button>
              {selectedPlace.kakao_url && (
                <Button variant="outline" className="flex-1" asChild>
                  <a href={selectedPlace.kakao_url} target="_blank" rel="noreferrer">
                    <ExternalLink />
                    카카오맵 상세
                  </a>
                </Button>
              )}
            </div>

            {canEdit && selectedPlace.status === "wish" && (
              <div className="space-y-1.5 rounded-lg border px-3 py-2.5">
                <p className="text-xs font-medium text-muted-foreground">
                  다녀왔어요! 어땠나요?
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={saving}
                    onClick={() => void markVisited("liked")}
                  >
                    💙 또 가고 싶어요
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={saving}
                    onClick={() => void markVisited("disliked")}
                  >
                    👎 별로였어요
                  </Button>
                </div>
              </div>
            )}

            {canEdit && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => openEdit(selectedPlace)}
                >
                  <Pencil />
                  수정
                </Button>
                {confirmDelete ? (
                  <Button
                    variant="destructive"
                    className="flex-1"
                    disabled={saving}
                    onClick={() => void deletePlace()}
                  >
                    정말 삭제할까요?
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 />
                    삭제
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ---------- 장소 추가/수정 모달 ---------- */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingPlace ? "장소 수정" : "장소 추가"}
        widthClass="sm:max-w-lg"
      >
        <div className="space-y-4">
          {!editingPlace && (
            <div className="space-y-1.5">
              <Label htmlFor="place-search">장소 검색</Label>
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="place-search"
                    placeholder="가게·장소 이름으로 검색"
                    className="pl-9"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        runSearch();
                      }
                    }}
                  />
                </div>
                <Button type="button" variant="outline" onClick={runSearch}>
                  검색
                </Button>
              </div>
              {searched && results.length === 0 && !picked && (
                <p className="text-xs text-muted-foreground">
                  검색 결과가 없어요.
                </p>
              )}
              {results.length > 0 && (
                <ul className="max-h-48 divide-y overflow-y-auto rounded-lg border">
                  {results.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => {
                          pickResult(r);
                          setResults([]);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/40"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-sm font-medium">
                            <span className="truncate">{r.place_name}</span>
                            {r.category_name && (
                              <span className="shrink-0 text-xs font-normal text-muted-foreground">
                                {searchCategoryLabel(r.category_name)}
                              </span>
                            )}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {r.road_address_name || r.address_name}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {picked && (
                <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                  <p className="font-medium">{picked.place_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {picked.road_address_name || picked.address_name}
                  </p>
                </div>
              )}
            </div>
          )}

          {(editingPlace || picked) && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="place-name">이름</Label>
                <Input
                  id="place-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>카테고리</Label>
                <div className="flex flex-wrap gap-1.5">
                  {sortedCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setFormCategoryId(cat.id)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium",
                        formCategoryId === cat.id
                          ? "border-primary bg-primary/10"
                          : "bg-card text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {cat.icon} {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>상태</Label>
                <div className="flex gap-1.5">
                  {PLACE_STATUSES.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setFormStatus(s.key)}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium",
                        formStatus === s.key
                          ? "border-primary bg-primary/10"
                          : "bg-card text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="place-memo">한줄평 / 메모 (선택)</Label>
                <Input
                  id="place-memo"
                  placeholder="예: 웨이팅 있음, 평일 저녁 추천"
                  value={formMemo}
                  onChange={(e) => setFormMemo(e.target.value)}
                />
              </div>

              <Button
                className="w-full"
                disabled={!formName.trim() || saving}
                onClick={() => void savePlace()}
              >
                {editingPlace ? "저장" : "추가"}
              </Button>
            </>
          )}
        </div>
      </Modal>

      {/* ---------- 카테고리 관리 모달 ---------- */}
      <Modal
        open={catModalOpen}
        onClose={() => {
          setCatModalOpen(false);
          setEditingCat(null);
        }}
        title="장소 카테고리"
      >
        {editingCat === null ? (
          <div className="space-y-3">
            <ul className="divide-y rounded-lg border">
              {sortedCategories.map((cat) => (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => openCatEdit(cat)}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-muted/40"
                  >
                    <span className="shrink-0">{cat.icon}</span>
                    <span className="flex-1 font-medium">{cat.name}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                </li>
              ))}
              {sortedCategories.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                  카테고리가 없어요.
                </li>
              )}
            </ul>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => openCatEdit("new")}
            >
              <Plus />
              카테고리 추가
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="w-20 space-y-1.5">
                <Label htmlFor="place-cat-icon">이모지</Label>
                <Input
                  id="place-cat-icon"
                  className="text-center"
                  value={catIcon}
                  onChange={(e) => setCatIcon(e.target.value)}
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="place-cat-name">이름</Label>
                <Input
                  id="place-cat-name"
                  placeholder="예: 맛집, 숙소, 아이와 갈 곳"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setEditingCat(null)}
              >
                목록으로
              </Button>
              {editingCat !== "new" &&
                (catConfirmDelete ? (
                  <Button
                    variant="destructive"
                    className="flex-1"
                    disabled={saving}
                    onClick={() => void deleteCategory()}
                  >
                    정말 삭제할까요?
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setCatConfirmDelete(true)}
                  >
                    <Trash2 />
                    삭제
                  </Button>
                ))}
              <Button
                className="flex-1"
                disabled={!catName.trim() || saving}
                onClick={() => void saveCategory()}
              >
                {editingCat === "new" ? "추가" : "저장"}
              </Button>
            </div>
            {catConfirmDelete && (
              <p className="text-xs text-muted-foreground">
                이 카테고리의 장소는 미분류(📍)로 남아요.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
