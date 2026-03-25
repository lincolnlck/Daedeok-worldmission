"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { countryCenters } from "./data/countryCenters";
import { resolveCountryKey, customRegionCenters } from "./data/countryAliases";
import { getCountryIso2 } from "./data/countryIso2";
import Header from "./components/Header";
import StatsDashboard from "./components/StatsDashboard";
import { clearAllCachedImages, fetchImages, type ImageItem } from "./lib/imagesCache";

type ApiItem = {
  folderId: string;
  folderName: string;
  name: string;
  country: string;
  ministry: string;
  updatedAtMs?: number;
};

type MissionaryItem = ApiItem & { lat: number; lng: number };

const WorldMap = dynamic(() => import("./components/WorldMap"), { ssr: false });

const SIDEBAR_WIDTH_KEY = "mission-prayer-sidebar-width";
const FAVORITES_KEY = "mission-prayer-favorites";
const CACHE_KEY = "mission-prayer-missionaries";
const DEFAULT_SIDEBAR_WIDTH = 420;

function jitter(lat: number, lng: number, key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) % 100000;
  }

  const r1 = (hash % 1000) / 1000;
  const r2 = ((hash / 1000) % 1000) / 1000;
  return { lat: lat + (r1 - 0.5) * 0.6, lng: lng + (r2 - 0.5) * 0.6 };
}

function readSidebarWidth(): number {
  if (typeof window === "undefined") return DEFAULT_SIDEBAR_WIDTH;

  try {
    const raw = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    const parsed = raw ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(parsed) && parsed >= 280 && parsed <= 700) {
      return parsed;
    }
  } catch {
    // ignore
  }

  return DEFAULT_SIDEBAR_WIDTH;
}

function readFavoriteIds(): Set<string> {
  if (typeof window === "undefined") return new Set();

  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function readCachedMissionaries(): ApiItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return [];

    const cached = JSON.parse(raw) as { items?: ApiItem[] };
    return Array.isArray(cached.items) ? cached.items : [];
  } catch {
    return [];
  }
}

function formatUpdatedLabel(timestampMs: number): string {
  const date = new Date(timestampMs);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function formatShortDate(timestampMs: number): string {
  const date = new Date(timestampMs);
  return `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, "0")}`;
}

export default function Home() {
  const router = useRouter();
  const [items, setItems] = useState<ApiItem[]>(readCachedMissionaries);
  const [selected, setSelected] = useState<MissionaryItem | null>(null);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(() => readCachedMissionaries().length === 0);
  const [loadingImages, setLoadingImages] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "country" | "updated">("name");
  const [sidebarWidth, setSidebarWidth] = useState(readSidebarWidth);
  const [favoriteIds, setFavoriteIds] = useState(readFavoriteIds);
  const [latestNoticeIndex, setLatestNoticeIndex] = useState(0);
  const [referenceNow] = useState(() => Date.now());

  const isResizingRef = useRef(false);
  const lastWidthRef = useRef(sidebarWidth);

  const refreshMissionaries = useCallback((skipCache = false) => {
    try {
      sessionStorage.removeItem(CACHE_KEY);
      clearAllCachedImages();
    } catch {
      // ignore
    }

    setLoadingItems(true);
    const url = skipCache ? `/api/missionaries?refresh=1&_=${Date.now()}` : "/api/missionaries";

    fetch(url, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data?.items) ? data.items : [];
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
    let cancelled = false;

    fetch("/api/missionaries")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data?.items) ? data.items : [];
        setItems(list);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ items: list }));
        } catch {
          // ignore
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load missionaries:", err);
        setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingItems(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selected) return;

    let cancelled = false;

    fetchImages(selected.folderId)
      .then(({ images: nextImages }) => {
        if (!cancelled) setImages(nextImages);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to load images:", err);
          setImages([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingImages(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected]);

  const startResize = useCallback(() => {
    isResizingRef.current = true;

    const onMove = (event: MouseEvent) => {
      const width = Math.min(700, Math.max(280, event.clientX));
      lastWidthRef.current = width;
      setSidebarWidth(width);
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

  const toggleFavorite = useCallback((folderId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

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

  const handleSelectMissionary = useCallback((missionary: MissionaryItem) => {
    setSelected(missionary);
    setLoadingImages(true);
  }, []);

  const mapped = useMemo<MissionaryItem[]>(() => {
    return items.map((item) => {
      const key = resolveCountryKey(item.country, countryCenters);
      const center = countryCenters[key] ?? customRegionCenters[key] ?? { lat: 20, lng: 0 };
      const adjusted = jitter(center.lat, center.lng, item.folderName);
      return { ...item, lat: adjusted.lat, lng: adjusted.lng };
    });
  }, [items]);

  const countries = useMemo(() => {
    const countrySet = new Set(mapped.map((item) => item.country).filter(Boolean));
    return Array.from(countrySet).sort();
  }, [mapped]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return mapped.filter((item) => {
      const matchesKeyword =
        !keyword ||
        (item.name + item.country + item.ministry + item.folderName).toLowerCase().includes(keyword);
      const matchesCountry = !selectedCountry || item.country === selectedCountry;
      return matchesKeyword && matchesCountry;
    });
  }, [mapped, query, selectedCountry]);

  const filteredWithFavoritesFirst = useMemo(() => {
    const compare = (a: MissionaryItem, b: MissionaryItem) => {
      if (sortBy === "country") {
        const countryCompare = (a.country || "").localeCompare(b.country || "", "ko");
        return countryCompare !== 0
          ? countryCompare
          : (a.name || "").localeCompare(b.name || "", "ko");
      }

      if (sortBy === "updated") {
        return (b.updatedAtMs ?? 0) - (a.updatedAtMs ?? 0);
      }

      return (a.name || "").localeCompare(b.name || "", "ko");
    };

    const favorites: MissionaryItem[] = [];
    const others: MissionaryItem[] = [];

    for (const item of filtered) {
      if (favoriteIds.has(item.folderId)) favorites.push(item);
      else others.push(item);
    }

    return [...favorites.sort(compare), ...others.sort(compare)];
  }, [favoriteIds, filtered, sortBy]);

  const stats = useMemo(() => {
    const uniqueCountries = new Set(mapped.map((item) => item.country).filter(Boolean));
    return {
      totalMissionaries: mapped.length,
      totalCountries: uniqueCountries.size,
      visibleCount: filtered.length,
    };
  }, [filtered.length, mapped]);

  const latestUpdatesList = useMemo(() => {
    const cutoff = referenceNow - 30 * 24 * 60 * 60 * 1000;

    return mapped
      .filter((item) => (item.updatedAtMs ?? 0) >= cutoff)
      .sort((a, b) => (b.updatedAtMs ?? 0) - (a.updatedAtMs ?? 0))
      .map((missionary) => ({
        missionary,
        dateLabel: formatUpdatedLabel(missionary.updatedAtMs ?? 0),
      }));
  }, [mapped, referenceNow]);

  useEffect(() => {
    if (latestUpdatesList.length <= 1) return;

    const timer = setInterval(() => {
      setLatestNoticeIndex((prev) => (prev + 1) % latestUpdatesList.length);
    }, 8000);

    return () => clearInterval(timer);
  }, [latestUpdatesList.length]);

  const sidebarContent = (
    <>
      <StatsDashboard
        totalMissionaries={stats.totalMissionaries}
        totalCountries={stats.totalCountries}
        onRefresh={() => refreshMissionaries(true)}
        isRefreshing={loadingItems}
      />

      <div className="mb-4 space-y-2 md:space-y-3">
        <input
          className="w-full rounded-lg border border-gray-300 px-3 md:px-4 py-2.5 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all touch-manipulation"
          placeholder="선교사 이름이나 국가 검색..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          className="w-full rounded-lg border border-gray-300 px-3 md:px-4 py-2.5 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white touch-manipulation"
          value={selectedCountry}
          onChange={(event) => setSelectedCountry(event.target.value)}
        >
          <option value="">모든 국가</option>
          {countries.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </select>
      </div>

      {latestUpdatesList.length > 0 && (() => {
        const current = latestUpdatesList[latestNoticeIndex % latestUpdatesList.length];
        const iso2 = getCountryIso2(resolveCountryKey(current.missionary.country, countryCenters));
        const isCCountry = current.missionary.country?.trim() === "C국";

        return (
          <button
            type="button"
            onClick={() => router.push(`/viewer/${current.missionary.folderId}`)}
            className="w-full mb-3 text-left rounded-lg px-3 py-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-sm hover:bg-amber-100 active:bg-amber-100 transition-colors touch-manipulation"
          >
            {isCCountry ? (
              <span
                style={{
                  display: "inline-block",
                  width: 18,
                  height: 14,
                  flexShrink: 0,
                  marginRight: 6,
                  backgroundColor: "#dc2626",
                  borderRadius: 2,
                }}
                aria-hidden
              />
            ) : iso2 ? (
              <span
                className={`fi fi-${iso2}`}
                style={{ display: "inline-block", width: 18, height: 14, flexShrink: 0, marginRight: 6 }}
                aria-hidden
              />
            ) : null}
            <span className="font-medium">{current.missionary.name} 선교사님</span>의 기도편지가{" "}
            {current.dateLabel} 업데이트되었습니다.
          </button>
        );
      })()}

      <div className="mb-3">
        <span className="text-xs md:text-sm font-medium text-gray-600 mr-2">정렬:</span>
        <div className="flex gap-1.5 mt-1">
          {(["name", "country", "updated"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setSortBy(value)}
              className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors touch-manipulation ${
                sortBy === value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {value === "name" ? "이름" : value === "country" ? "국가" : "업데이트"}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        {filteredWithFavoritesFirst.some((item) => favoriteIds.has(item.folderId)) && (
          <h3 className="text-xs md:text-sm font-semibold text-amber-600 mb-1.5">즐겨찾기</h3>
        )}
        <h3 className="text-xs md:text-sm font-semibold text-gray-700 mb-2">선교사 목록</h3>
        <div className="space-y-1.5 md:space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <p className="text-sm">검색 결과가 없습니다.</p>
            </div>
          ) : (
            filteredWithFavoritesFirst.slice(0, 50).map((missionary) => {
              const isFavorite = favoriteIds.has(missionary.folderId);
              const countryKey = resolveCountryKey(missionary.country, countryCenters);
              const iso2 = getCountryIso2(countryKey);
              const isCCountry = missionary.country?.trim() === "C국";

              return (
                <div
                  key={missionary.folderId}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/viewer/${missionary.folderId}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(`/viewer/${missionary.folderId}`);
                    }
                  }}
                  className={`w-full text-left rounded-lg px-3 py-2.5 border transition-[background-color,border-color,transform,box-shadow] duration-150 touch-manipulation cursor-pointer flex items-center gap-2 ${
                    selected?.folderId === missionary.folderId
                      ? "bg-blue-50 border-blue-300 shadow-sm hover:bg-blue-100 hover:border-blue-400 active:scale-[0.98] active:bg-blue-200/90 active:shadow-inner"
                      : "bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-200 active:scale-[0.98] active:bg-blue-100 active:border-blue-300 active:shadow-inner"
                  }`}
                >
                  <button
                    type="button"
                    onClick={(event) => toggleFavorite(missionary.folderId, event)}
                    className="flex-shrink-0 w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-colors touch-manipulation"
                    aria-label={isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}
                    title={isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}
                  >
                    {isFavorite ? "★" : "☆"}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-gray-900 text-sm md:text-base flex items-center gap-2 min-w-0">
                      {isCCountry ? (
                        <span
                          style={{
                            display: "inline-block",
                            width: 20,
                            height: 15,
                            flexShrink: 0,
                            backgroundColor: "#dc2626",
                            borderRadius: 2,
                          }}
                          title={missionary.country || undefined}
                          aria-hidden
                        />
                      ) : iso2 ? (
                        <span
                          className={`fi fi-${iso2}`}
                          style={{ display: "inline-block", width: 20, height: 15, flexShrink: 0 }}
                          title={missionary.country || undefined}
                          aria-hidden
                        />
                      ) : null}
                      <span className="truncate">{missionary.name} 선교사</span>
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">{missionary.country || "국가 미지정"}</div>
                  </div>

                  {missionary.updatedAtMs != null ? (
                    <span className="flex-shrink-0 text-[10px] md:text-xs text-gray-500">
                      {formatShortDate(missionary.updatedAtMs)}
                    </span>
                  ) : (
                    <span className="flex-shrink-0 text-[10px] md:text-xs text-gray-400">-</span>
                  )}
                </div>
              );
            })
          )}

          {filtered.length > 50 && (
            <div className="text-[10px] md:text-xs text-gray-500 text-center py-2">
              상위 50명만 표시 중입니다. 검색어로 더 좁혀보세요.
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div className="space-y-3 md:space-y-4 border-t pt-3 md:pt-4">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-3 md:p-4 border border-blue-100">
            <div className="text-lg md:text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
              {(() => {
                const countryKey = resolveCountryKey(selected.country, countryCenters);
                const iso2 = getCountryIso2(countryKey);
                const isCCountry = selected.country?.trim() === "C국";

                if (isCCountry) {
                  return (
                    <span
                      style={{
                        display: "inline-block",
                        width: 28,
                        height: 21,
                        flexShrink: 0,
                        backgroundColor: "#dc2626",
                        borderRadius: 2,
                      }}
                      title={selected.country || undefined}
                      aria-hidden
                    />
                  );
                }

                return iso2 ? (
                  <span
                    className={`fi fi-${iso2}`}
                    style={{ display: "inline-block", width: 28, height: 21, flexShrink: 0 }}
                    title={selected.country || undefined}
                    aria-hidden
                  />
                ) : null;
              })()}
              <span>{selected.name}</span>
            </div>
            <div className="text-xs md:text-sm text-gray-600 mb-1">국가: {selected.country || "국가 미지정"}</div>
            {selected.ministry && (
              <div className="text-xs md:text-sm text-gray-700 mt-2">{selected.ministry}</div>
            )}
            <div className="text-[10px] md:text-xs text-gray-500 mt-2 break-all">{selected.folderName}</div>
            <button
              onClick={() => router.push(`/viewer/${selected.folderId}`)}
              className="mt-3 md:mt-4 w-full rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 text-white text-sm md:text-base font-medium active:from-blue-700 active:to-purple-700 transition-all shadow-md touch-manipulation"
            >
              기도편지 보기
            </button>
          </div>

          {loadingImages && (
            <div className="text-center py-3">
              <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mb-2" />
              <p className="text-xs text-gray-600">이미지를 확인하는 중...</p>
            </div>
          )}

          {!loadingImages && images.length > 0 && (
            <div className="text-center py-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-xs md:text-sm text-green-700 font-medium">
                현재 {images.length}개의 기도편지가 있습니다.
              </p>
              <p className="text-[10px] md:text-xs text-green-600 mt-1">버튼을 눌러 전체 이미지를 확인해 보세요.</p>
            </div>
          )}

          {!loadingImages && images.length === 0 && (
            <div className="text-center py-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-xl mb-2">📭</div>
              <p className="text-xs text-gray-600">아직 등록된 기도편지가 없습니다.</p>
              <p className="text-[10px] text-gray-500 mt-1">해당 폴더에 JPG 파일이 있는지 확인해 주세요.</p>
            </div>
          )}
        </div>
      )}
    </>
  );

  return (
    <>
      <div className="lg:hidden flex flex-col min-h-screen">
        <Header />
        <div className="flex-1 overflow-y-auto">
          <div className="h-[35vh] relative">
            {loadingItems ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
                  <p className="text-gray-600">선교사 목록을 불러오는 중...</p>
                </div>
              </div>
            ) : (
              <WorldMap items={filtered} onSelect={handleSelectMissionary} />
            )}
          </div>
          <div className="min-h-screen bg-white border-t p-3">{sidebarContent}</div>
        </div>
      </div>

      <div className="hidden lg:flex lg:flex-col lg:h-screen">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <aside className="flex-shrink-0 bg-white overflow-y-auto p-4" style={{ width: sidebarWidth }}>
            {sidebarContent}
          </aside>

          <div
            role="separator"
            aria-label="사이드바 너비 조절"
            onMouseDown={startResize}
            className="flex-shrink-0 w-2 cursor-col-resize bg-gray-200 hover:bg-blue-300 active:bg-blue-400 transition-colors"
          />

          <div className="flex-1 relative min-w-0">
            {loadingItems ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
                  <p className="text-gray-600">선교사 목록을 불러오는 중...</p>
                </div>
              </div>
            ) : (
              <WorldMap items={filtered} onSelect={handleSelectMissionary} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
