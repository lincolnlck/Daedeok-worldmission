"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getCountryIso2 } from "@/app/data/countryIso2";
import { resolveCountryKey } from "@/app/data/countryAliases";
import { countryCenters } from "@/app/data/countryCenters";
import { matchMissionaryByName } from "@/app/lib/matchMissionaryByName";
import type { PrayerListItem } from "@/app/api/prayer-list/route";

type MissionaryItem = { name: string; folderId: string };

const PRAYER_LIST_FAVORITES_KEY = "mission-prayer-prayer-list-favorites";

function getFavoriteKey(item: PrayerListItem): string {
  return `${item.name ?? ""}|${item.country ?? ""}`;
}

export default function PrayerListPage() {
  const [data, setData] = useState<{
    success: boolean;
    items: PrayerListItem[];
    fileName?: string;
    error?: string;
  } | null>(null);
  const [missionaries, setMissionaries] = useState<MissionaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"default" | "name" | "country">("default");
  const [favoriteKeys, setFavoriteKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRAYER_LIST_FAVORITES_KEY);
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      if (Array.isArray(arr) && arr.length > 0) {
        setFavoriteKeys(new Set(arr));
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleFavorite = useCallback((key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFavoriteKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        localStorage.setItem(PRAYER_LIST_FAVORITES_KEY, JSON.stringify([...next]));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/prayer-list").then((res) => res.json()),
      fetch("/api/missionaries").then((res) => res.json()),
    ])
      .then(([prayerData, missionaryData]) => {
        setData(prayerData);
        const list = Array.isArray(missionaryData?.items) ? missionaryData.items : [];
        setMissionaries(
          list.map((m: { name?: string; folderId?: string }) => ({
            name: m.name ?? "",
            folderId: m.folderId ?? "",
          }))
        );
      })
      .catch((err) => {
        console.error(err);
        setData({ success: false, items: [], error: String(err) });
      })
      .finally(() => setLoading(false));
  }, []);

  const sortedItems = useMemo(() => {
    const items = data?.success && data.items ? [...data.items] : [];
    if (sortBy === "name") {
      items.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ko"));
    } else if (sortBy === "country") {
      items.sort((a, b) => {
        const c = (a.country || "").localeCompare(b.country || "", "ko");
        return c !== 0 ? c : (a.name || "").localeCompare(b.name || "", "ko");
      });
    }
    return items;
  }, [data?.items, data?.success, sortBy]);

  const displayItems = useMemo(() => {
    const favMatched: PrayerListItem[] = [];
    const favUnmatched: PrayerListItem[] = [];
    const restMatched: PrayerListItem[] = [];
    const restUnmatched: PrayerListItem[] = [];
    for (const item of sortedItems) {
      const isFav = favoriteKeys.has(getFavoriteKey(item));
      const matched = !!matchMissionaryByName(missionaries, item.name);
      if (isFav) {
        if (matched) favMatched.push(item);
        else favUnmatched.push(item);
      } else {
        if (matched) restMatched.push(item);
        else restUnmatched.push(item);
      }
    }
    return [...favMatched, ...favUnmatched, ...restMatched, ...restUnmatched];
  }, [sortedItems, favoriteKeys, missionaries]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg">
        <div className="container mx-auto px-3 md:px-4 py-3 md:py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-white hover:text-blue-100 text-lg font-bold rounded-full w-9 h-9 flex items-center justify-center hover:bg-white/10 transition-colors"
              aria-label="홈으로"
            >
              ←
            </Link>
            <div>
              <h1 className="text-lg md:text-xl font-bold">선교사를 위한 기도 제목</h1>
              <p className="text-blue-100 text-xs md:text-sm">※ 기도제목은 분기마다 한번씩 업데이트가 되며, 최신의 기도제목은 기도편지에서 확인하실 수 있습니다.</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 md:px-4 py-4 md:py-6 max-w-3xl">
        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4" />
            <p className="text-gray-600 text-sm">기도 제목을 불러오는 중...</p>
          </div>
        )}

        {!loading && data && !data.success && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-amber-800 text-sm">
            <p className="font-medium">불러오기 실패</p>
            <p className="mt-1">{data.error || "알 수 없는 오류"}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                fetch("/api/prayer-list?refresh=1")
                  .then((res) => res.json())
                  .then(setData)
                  .finally(() => setLoading(false));
              }}
              className="mt-3 text-blue-600 underline text-sm"
            >
              다시 시도
            </button>
          </div>
        )}

        {!loading && data?.success && data.items.length === 0 && (
          <div className="text-center py-16 text-gray-500 text-sm">
            <p>등록된 기도 제목이 없습니다.</p>
            <p className="mt-1">Drive에 &quot;선교사를_위한_기도문&quot;으로 시작하는 파일을 올려 주세요.</p>
          </div>
        )}

        {!loading && data?.success && data.items.length > 0 && (
          <>
            {data.fileName && (
              <p className="text-xs text-gray-500 mb-4">📄 {data.fileName}</p>
            )}

            <div className="mb-4">
              <span className="text-xs md:text-sm font-medium text-gray-600 mr-2">정렬:</span>
              <div className="flex gap-1.5 mt-1">
                <button
                  type="button"
                  onClick={() => setSortBy("default")}
                  className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                    sortBy === "default"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  기본
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy("name")}
                  className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors ${
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
                  className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                    sortBy === "country"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  국가
                </button>
              </div>
            </div>

            {favoriteKeys.size > 0 && (
              <h3 className="text-xs md:text-sm font-semibold text-amber-600 mb-1.5">⭐ 즐겨찾기</h3>
            )}
            <div className="space-y-2">
              {displayItems.map((item) => {
                const isExpanded = expandedOrder === item.order;
                const countryKey = resolveCountryKey(item.country, countryCenters);
                const iso2 = getCountryIso2(countryKey);
                const isCCountry = item.country?.trim() === "C국";
                const folderId = matchMissionaryByName(missionaries, item.name);
                const favKey = getFavoriteKey(item);
                const isFav = favoriteKeys.has(favKey);

                return (
                  <div
                    key={`${item.order}-${item.name}`}
                    className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden"
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        setExpandedOrder(isExpanded ? null : item.order)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setExpandedOrder(isExpanded ? null : item.order);
                        }
                      }}
                      className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavorite(favKey, e)}
                        className="flex-shrink-0 w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"
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
                      <span className="flex-shrink-0 w-7 text-center text-sm font-medium text-gray-500">
                        {item.order}
                      </span>
                      {isCCountry ? (
                        <span
                          className="flex-shrink-0 w-5 h-4 rounded bg-red-600"
                          aria-hidden
                        />
                      ) : iso2 ? (
                        <span
                          className={`fi fi-${iso2}`}
                          style={{
                            display: "inline-block",
                            width: 20,
                            height: 15,
                            flexShrink: 0,
                          }}
                          aria-hidden
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-gray-900 text-sm md:text-base block truncate">
                          {item.name || "(이름 없음)"}
                        </span>
                        {(item.country || item.reference) && (
                          <span className="text-xs text-gray-500">
                            {[item.country, item.reference].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </div>
                      {folderId ? (
                        <Link
                          href={`/viewer/${folderId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-shrink-0 inline-flex items-center text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full py-2 px-3 hover:bg-blue-100 hover:border-blue-300 transition-colors shadow-sm"
                        >
                          기도편지
                        </Link>
                      ) : null}
                      <span
                        className={`flex-shrink-0 text-gray-400 transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                        aria-hidden
                      >
                        ▼
                      </span>
                    </div>
                    {isExpanded && item.prayerContent && (
                      <div className="px-4 pb-4 pt-0">
                        <div className="border-t border-gray-100 pt-3">
                          <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {item.prayerContent}
                          </div>
                          {item.reference && (
                            <p className="text-xs text-gray-500 mt-2">
                              참고: {item.reference}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
