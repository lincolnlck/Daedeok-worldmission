"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { countryCenters } from "./data/countryCenters";
import { resolveCountryKey, customRegionCenters } from "./data/countryAliases";
import Header from "./components/Header";
import ImageModal from "./components/ImageModal";
import StatsDashboard from "./components/StatsDashboard";

type ApiItem = {
  folderId: string;
  folderName: string;
  name: string;
  country: string;
  ministry: string;
  updatedAtMs?: number;
};

type MissionaryItem = ApiItem & { lat: number; lng: number };

type ImageItem = { fileId: string; name: string; url: string };

const WorldMap = dynamic(() => import("./components/WorldMap"), { ssr: false });

function jitter(lat: number, lng: number, key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 100000;
  const r1 = (h % 1000) / 1000;
  const r2 = ((h / 1000) % 1000) / 1000;
  return { lat: lat + (r1 - 0.5) * 0.6, lng: lng + (r2 - 0.5) * 0.6 };
}

export default function Home() {
  const router = useRouter();
  const [items, setItems] = useState<ApiItem[]>([]);
  const [selected, setSelected] = useState<MissionaryItem | null>(null);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingImages, setLoadingImages] = useState(false);
  const [q, setQ] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [modalImage, setModalImage] = useState<ImageItem | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "country" | "updated">("name");

  const SIDEBAR_WIDTH_KEY = "mission-prayer-sidebar-width";
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === "undefined") return 420;
    try {
      const w = localStorage.getItem(SIDEBAR_WIDTH_KEY);
      const n = w ? parseInt(w, 10) : NaN;
      return Number.isFinite(n) && n >= 280 && n <= 700 ? n : 420;
    } catch {
      return 420;
    }
  });
  const isResizingRef = useRef(false);
  const lastWidthRef = useRef(sidebarWidth);

  const FAVORITES_KEY = "mission-prayer-favorites";
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      if (Array.isArray(arr) && arr.length > 0) {
        setFavoriteIds(new Set(arr));
      }
    } catch {
      // ignore
    }
  }, []);

  const startResize = useCallback(() => {
    isResizingRef.current = true;
    const minW = 280;
    const maxW = 700;
    const onMove = (e: MouseEvent) => {
      const w = Math.min(maxW, Math.max(minW, e.clientX));
      lastWidthRef.current = w;
      setSidebarWidth(w);
    };
    const onUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try {
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(lastWidthRef.current));
      } catch {
        // ignore
      }
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  const toggleFavorite = useCallback((folderId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const CACHE_KEY = "mission-prayer-missionaries";

  const refreshMissionaries = useCallback((skipCache = false) => {
    try {
      sessionStorage.removeItem(CACHE_KEY);
    } catch {
      // ignore
    }
    setLoadingItems(true);
    const url = skipCache
      ? `/api/missionaries?refresh=1&_=${Date.now()}`
      : "/api/missionaries";
    fetch(url, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const list = d.items ?? [];
        setItems(list);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ items: list }));
        } catch {
          // ignore
        }
      })
      .catch((err) => {
        console.error("Failed to load missionaries:", err);
        setItems([]);
      })
      .finally(() => setLoadingItems(false));
  }, []);

  useEffect(() => {
    const raw = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(CACHE_KEY) : null;
    if (raw) {
      try {
        const { items: cachedItems } = JSON.parse(raw) as { items: ApiItem[] };
        if (Array.isArray(cachedItems) && cachedItems.length >= 0) {
          setItems(cachedItems);
          setLoadingItems(false);
        }
      } catch {
        // ignore invalid cache
      }
    }

    fetch("/api/missionaries")
      .then((r) => r.json())
      .then((d) => {
        const list = d.items ?? [];
        setItems(list);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ items: list }));
        } catch {
          // ignore quota etc
        }
      })
      .catch((err) => {
        console.error("Failed to load missionaries:", err);
        setItems([]);
      })
      .finally(() => setLoadingItems(false));
  }, []);

  const mapped: MissionaryItem[] = useMemo(() => {
    return items.map((m) => {
      const key = resolveCountryKey(m.country, countryCenters);
      const center =
        countryCenters[key] ??
        customRegionCenters[key] ??
        { lat: 20, lng: 0 };
      const j = jitter(center.lat, center.lng, m.folderName);
      return { ...m, lat: j.lat, lng: j.lng };
    });
  }, [items]);

  const countries = useMemo(() => {
    const countrySet = new Set(mapped.map((m) => m.country).filter(Boolean));
    return Array.from(countrySet).sort();
  }, [mapped]);

  const filtered = useMemo(() => {
    let result = mapped;
    const s = q.trim().toLowerCase();
    if (s) {
      result = result.filter((m) =>
        (m.name + m.country + m.ministry + m.folderName).toLowerCase().includes(s)
      );
    }
    if (selectedCountry) {
      result = result.filter((m) => m.country === selectedCountry);
    }
    return result;
  }, [mapped, q, selectedCountry]);

  const sortMissionaries = useCallback((list: MissionaryItem[]) => {
    return [...list].sort((a, b) => {
      if (sortBy === "name") {
        return (a.name || "").localeCompare(b.name || "", "ko");
      }
      if (sortBy === "country") {
        const c = (a.country || "").localeCompare(b.country || "", "ko");
        return c !== 0 ? c : (a.name || "").localeCompare(b.name || "", "ko");
      }
      if (sortBy === "updated") {
        const ta = a.updatedAtMs ?? 0;
        const tb = b.updatedAtMs ?? 0;
        return tb - ta;
      }
      return 0;
    });
  }, [sortBy]);

  const filteredWithFavoritesFirst = useMemo(() => {
    const fav: MissionaryItem[] = [];
    const rest: MissionaryItem[] = [];
    for (const m of filtered) {
      if (favoriteIds.has(m.folderId)) fav.push(m);
      else rest.push(m);
    }
    return [...sortMissionaries(fav), ...sortMissionaries(rest)];
  }, [filtered, favoriteIds, sortMissionaries]);

  const stats = useMemo(() => {
    const uniqueCountries = new Set(mapped.map((m) => m.country).filter(Boolean));
    return {
      totalMissionaries: mapped.length,
      totalCountries: uniqueCountries.size,
      visibleCount: filtered.length,
    };
  }, [mapped, filtered]);

  const latestUpdateNotice = useMemo(() => {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const cutoff = now - THIRTY_DAYS_MS;
    let latest: MissionaryItem | null = null;
    for (const m of mapped) {
      const t = m.updatedAtMs ?? 0;
      if (t < cutoff) continue;
      if (!latest || t > (latest.updatedAtMs ?? 0)) latest = m;
    }
    if (!latest) return null;
    const d = new Date(latest.updatedAtMs!);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return { missionary: latest, dateLabel: `${month}월 ${day}일` };
  }, [mapped]);

  useEffect(() => {
    if (!selected) {
      setImages([]);
      return;
    }
    setLoadingImages(true);
    fetch(`/api/images?folderId=${encodeURIComponent(selected.folderId)}`)
      .then((r) => r.json())
      .then((d) => setImages(d.images ?? []))
      .catch((err) => {
        console.error("Failed to load images:", err);
        setImages([]);
      })
      .finally(() => setLoadingImages(false));
  }, [selected]);

  const openImageModal = (image: ImageItem) => {
    setModalImage(image);
  };

  const closeImageModal = () => {
    setModalImage(null);
  };

  const currentImageIndex = modalImage
    ? images.findIndex((img) => img.fileId === modalImage.fileId)
    : -1;

  const nextImage = () => {
    if (currentImageIndex < images.length - 1) {
      setModalImage(images[currentImageIndex + 1]);
    }
  };

  const prevImage = () => {
    if (currentImageIndex > 0) {
      setModalImage(images[currentImageIndex - 1]);
    }
  };

  /* ---------- 사이드바 내용 (공통) ---------- */
  const sidebarContent = (
    <>
      <StatsDashboard
        totalMissionaries={stats.totalMissionaries}
        totalCountries={stats.totalCountries}
        onRefresh={() => refreshMissionaries(true)}
        isRefreshing={loadingItems}
      />

      {/* 검색 및 필터 */}
      <div className="mb-4 space-y-2 md:space-y-3">
        <input
          className="w-full rounded-lg border border-gray-300 px-3 md:px-4 py-2.5 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all touch-manipulation"
          placeholder="🔍 이름/나라로 검색..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="w-full rounded-lg border border-gray-300 px-3 md:px-4 py-2.5 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white touch-manipulation"
          value={selectedCountry}
          onChange={(e) => setSelectedCountry(e.target.value)}
        >
          <option value="">🌍 모든 국가</option>
          {countries.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </select>
      </div>

      {/* 최근 업데이트 알림 (지난 30일 이내 있을 때만) */}
      {latestUpdateNotice && (
        <button
          type="button"
          onClick={() => router.push(`/viewer/${latestUpdateNotice.missionary.folderId}`)}
          className="w-full mb-3 text-left rounded-lg px-3 py-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-sm hover:bg-amber-100 active:bg-amber-100 transition-colors touch-manipulation"
        >
          <span className="font-medium">{latestUpdateNotice.missionary.name} 선교사님</span>의 기도편지가 {latestUpdateNotice.dateLabel} 업데이트되었습니다.
        </button>
      )}

      {/* 정렬 */}
      <div className="mb-3">
        <span className="text-xs md:text-sm font-medium text-gray-600 mr-2">정렬:</span>
        <div className="flex gap-1.5 mt-1">
          <button
            type="button"
            onClick={() => setSortBy("name")}
            className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors touch-manipulation ${
              sortBy === "name"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            이름
          </button>
          <button
            type="button"
            onClick={() => setSortBy("country")}
            className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors touch-manipulation ${
              sortBy === "country"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            나라
          </button>
          <button
            type="button"
            onClick={() => setSortBy("updated")}
            className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors touch-manipulation ${
              sortBy === "updated"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            업데이트
          </button>
        </div>
      </div>

      {/* 선교사 목록 */}
      <div className="mb-4">
        {filteredWithFavoritesFirst.some((m) => favoriteIds.has(m.folderId)) && (
          <h3 className="text-xs md:text-sm font-semibold text-amber-600 mb-1.5">⭐ 즐겨찾기</h3>
        )}
        <h3 className="text-xs md:text-sm font-semibold text-gray-700 mb-2">선교사 목록</h3>
        <div className="space-y-1.5 md:space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <p className="text-sm">검색 결과가 없습니다</p>
            </div>
          ) : (
            filteredWithFavoritesFirst.slice(0, 50).map((m) => {
              const isFav = favoriteIds.has(m.folderId);
              return (
                <div
                  key={m.folderId}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/viewer/${m.folderId}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/viewer/${m.folderId}`);
                    }
                  }}
                  className={`w-full text-left rounded-lg px-3 py-2.5 border transition-all touch-manipulation active:scale-[0.98] flex items-center gap-2 ${
                    selected?.folderId === m.folderId
                      ? "bg-blue-50 border-blue-300 shadow-sm"
                      : "bg-white border-gray-200 active:bg-gray-50 active:border-gray-300"
                  }`}
                >
                  <button
                    type="button"
                    onClick={(e) => toggleFavorite(m.folderId, e)}
                    className="flex-shrink-0 w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-colors touch-manipulation"
                    aria-label={isFav ? "즐겨찾기 해제" : "즐겨찾기"}
                    title={isFav ? "즐겨찾기 해제" : "즐겨찾기"}
                  >
                    {isFav ? (
                      <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-gray-900 text-sm md:text-base">{m.name} 선교사</div>
                    <div className="text-xs text-gray-600 mt-0.5">{m.country || "국가 미지정"}</div>
                  </div>
                </div>
              );
            })
          )}
          {filtered.length > 50 && (
            <div className="text-[10px] md:text-xs text-gray-500 text-center py-2">
              상위 50개만 표시 중 (검색으로 좁혀주세요)
            </div>
          )}
        </div>
      </div>

      {/* 선택된 선교사 정보 */}
      {selected && (
        <div className="space-y-3 md:space-y-4 border-t pt-3 md:pt-4">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-3 md:p-4 border border-blue-100">
            <div className="text-lg md:text-xl font-bold text-gray-900 mb-1">{selected.name}</div>
            <div className="text-xs md:text-sm text-gray-600 mb-1">📍 {selected.country || "국가 미지정"}</div>
            {selected.ministry && (
              <div className="text-xs md:text-sm text-gray-700 mt-2">{selected.ministry}</div>
            )}
            <div className="text-[10px] md:text-xs text-gray-500 mt-2 break-all">{selected.folderName}</div>
            <button
              onClick={() => router.push(`/viewer/${selected.folderId}`)}
              className="mt-3 md:mt-4 w-full rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 text-white text-sm md:text-base font-medium active:from-blue-700 active:to-purple-700 transition-all shadow-md touch-manipulation"
            >
              📖 기도편지 보기
            </button>
          </div>

          {loadingImages && (
            <div className="text-center py-3">
              <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mb-2"></div>
              <p className="text-xs text-gray-600">이미지 확인 중...</p>
            </div>
          )}
          {!loadingImages && images.length > 0 && (
            <div className="text-center py-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-xs md:text-sm text-green-700 font-medium">📸 {images.length}개의 기도편지가 있습니다</p>
              <p className="text-[10px] md:text-xs text-green-600 mt-1">위 버튼을 클릭하여 확인하세요</p>
            </div>
          )}
          {!loadingImages && images.length === 0 && (
            <div className="text-center py-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-xl mb-2">📭</div>
              <p className="text-xs text-gray-600">아직 선교지에서 기도편지가 도착하지 않았습니다🙏</p>
              <p className="text-[10px] text-gray-500 mt-1">해당 폴더에 JPG 파일을 추가해주세요</p>
            </div>
          )}
        </div>
      )}
    </>
  );

  return (
    <>
      {/* ====== 모바일 레이아웃 ====== */}
      <div className="lg:hidden flex flex-col min-h-screen">
        <Header />
        <div className="flex-1 overflow-y-auto">
          {/* 지도 - 고정 높이, 스크롤하면 위로 밀려남 */}
          <div className="h-[35vh] relative">
            {loadingItems ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-600">선교사 목록을 불러오는 중...</p>
                </div>
              </div>
            ) : (
              <WorldMap items={filtered} onSelect={setSelected} />
            )}
          </div>
          {/* 리스트 */}
          <div className="min-h-screen bg-white border-t p-3">
            {sidebarContent}
          </div>
        </div>
      </div>

      {/* ====== 데스크톱 레이아웃 ====== */}
      <div className="hidden lg:flex lg:flex-col lg:h-screen">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          {/* 사이드바 - 왼쪽 (리사이즈 가능) */}
          <aside
            className="flex-shrink-0 bg-white overflow-y-auto p-4"
            style={{ width: sidebarWidth }}
          >
            {sidebarContent}
          </aside>

          {/* 리사이저 바 */}
          <div
            role="separator"
            aria-label="리스트·지도 너비 조절"
            onMouseDown={startResize}
            className="flex-shrink-0 w-2 cursor-col-resize bg-gray-200 hover:bg-blue-300 active:bg-blue-400 transition-colors"
          />

          {/* 지도 - 오른쪽 (나머지 공간 전부) */}
          <div className="flex-1 relative min-w-0">
            {loadingItems ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-600">선교사 목록을 불러오는 중...</p>
                </div>
              </div>
            ) : (
              <WorldMap items={filtered} onSelect={setSelected} />
            )}
          </div>
        </div>
      </div>

      {/* 이미지 모달 */}
      {modalImage && (
        <ImageModal
          image={modalImage}
          images={images}
          onClose={closeImageModal}
          onNext={nextImage}
          onPrev={prevImage}
          hasNext={currentImageIndex < images.length - 1}
          hasPrev={currentImageIndex > 0}
        />
      )}
    </>
  );
}
