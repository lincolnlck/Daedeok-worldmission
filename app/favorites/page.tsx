"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getCountryIso2 } from "@/app/data/countryIso2";
import { resolveCountryKey } from "@/app/data/countryAliases";
import { countryCenters } from "@/app/data/countryCenters";
import { matchMissionaryByName } from "@/app/lib/matchMissionaryByName";
import PrintControls from "@/app/components/PrintControls";
import type { PrayerListItem } from "@/app/api/prayer-list/route";

const MAIN_FAVORITES_KEY = "mission-prayer-favorites";
const PRAYER_LIST_FAVORITES_KEY = "mission-prayer-prayer-list-favorites";
const FONT_SIZE_STORAGE_KEY = "mission-prayer-favorites-font-size";
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 28;
const DEFAULT_FONT_SIZE = 16;

type MissionaryFromApi = {
  folderId: string;
  folderName: string;
  name: string;
  country: string;
  ministry?: string;
  updatedAtMs?: number;
};

type FavoriteCard = {
  missionary: MissionaryFromApi | null;
  prayerItem: PrayerListItem | null;
};

type ImageItem = {
  fileId: string;
  name: string;
  url: string;
  updatedAtMs: number;
  updatedAt: string;
};

function getDateString(timestampMs: number): string {
  const date = new Date(timestampMs);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function filterImagesByDate(images: ImageItem[], targetDateMs: number): ImageItem[] {
  const targetDate = getDateString(targetDateMs);
  return images.filter((img) => getDateString(img.updatedAtMs) === targetDate);
}

function extractTrailingNumber(name: string): number {
  const withoutExt = name.replace(/\.[^.]+$/, "");
  const match = withoutExt.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

function sortImagesByUpdatedDate(images: ImageItem[]): ImageItem[] {
  return [...images].sort((a, b) => {
    const dateA = new Date(a.updatedAtMs);
    const dateB = new Date(b.updatedAtMs);

    dateA.setHours(0, 0, 0, 0);
    dateB.setHours(0, 0, 0, 0);

    const dayDiff = dateB.getTime() - dateA.getTime();
    if (dayDiff !== 0) return dayDiff;

    const numA = extractTrailingNumber(a.name);
    const numB = extractTrailingNumber(b.name);
    if (numA !== numB) return numA - numB;

    const updatedAtDiff = a.updatedAtMs - b.updatedAtMs;
    if (updatedAtDiff !== 0) return updatedAtDiff;

    return a.name.localeCompare(b.name, "ko");
  });
}

function getPrayerFavoriteKey(item: PrayerListItem): string {
  return `${item.name ?? ""}|${item.country ?? ""}`;
}

function readStoredArray(key: string): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readStoredFontSize(): number {
  if (typeof window === "undefined") return DEFAULT_FONT_SIZE;

  try {
    const saved = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    if (saved != null) {
      const parsed = parseInt(saved, 10);
      if (Number.isFinite(parsed) && parsed >= MIN_FONT_SIZE && parsed <= MAX_FONT_SIZE) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }

  return DEFAULT_FONT_SIZE;
}

export default function FavoritesPage() {
  const [missionaries, setMissionaries] = useState<MissionaryFromApi[]>([]);
  const [prayerData, setPrayerData] = useState<{
    success: boolean;
    items: PrayerListItem[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mainFavIds] = useState<Set<string>>(() => new Set(readStoredArray(MAIN_FAVORITES_KEY)));
  const [prayerFavKeys] = useState<Set<string>>(
    () => new Set(readStoredArray(PRAYER_LIST_FAVORITES_KEY))
  );
  const [fontSizePx, setFontSizePx] = useState(readStoredFontSize);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/missionaries").then((r) => r.json()),
      fetch("/api/prayer-list").then((r) => r.json()),
    ])
      .then(([missionaryRes, prayerRes]) => {
        const list = Array.isArray(missionaryRes?.items) ? missionaryRes.items : [];
        setMissionaries(list);
        setPrayerData(
          prayerRes?.success && prayerRes?.items ? { success: true, items: prayerRes.items } : null
        );
      })
      .catch(() => {
        setMissionaries([]);
        setPrayerData(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const missionaryForMatch = useMemo(
    () => missionaries.map((missionary) => ({ name: missionary.name, folderId: missionary.folderId })),
    [missionaries]
  );

  const cards = useMemo(() => {
    const list: FavoriteCard[] = [];
    const byFolderId = new Map<string, FavoriteCard>();
    const prayerItems = prayerData?.items ?? [];

    for (const missionary of missionaries) {
      if (!mainFavIds.has(missionary.folderId)) continue;

      const prayerItem =
        prayerItems.find(
          (item) => matchMissionaryByName(missionaryForMatch, item.name) === missionary.folderId
        ) ?? null;

      const card: FavoriteCard = { missionary, prayerItem };
      list.push(card);
      byFolderId.set(missionary.folderId, card);
    }

    for (const item of prayerItems) {
      if (!prayerFavKeys.has(getPrayerFavoriteKey(item))) continue;

      const folderId = matchMissionaryByName(missionaryForMatch, item.name);
      if (folderId && byFolderId.has(folderId)) {
        const existing = byFolderId.get(folderId);
        if (existing && !existing.prayerItem) existing.prayerItem = item;
        continue;
      }

      if (folderId) {
        const missionary = missionaries.find((entry) => entry.folderId === folderId) ?? null;
        if (missionary) {
          const card: FavoriteCard = { missionary, prayerItem: item };
          list.push(card);
          byFolderId.set(folderId, card);
          continue;
        }
      }

      list.push({ missionary: null, prayerItem: item });
    }

    list.sort((a, b) => {
      const nameA = a.missionary?.name ?? a.prayerItem?.name ?? "";
      const nameB = b.missionary?.name ?? b.prayerItem?.name ?? "";
      return nameA.localeCompare(nameB, "ko");
    });

    return list;
  }, [mainFavIds, missionaries, missionaryForMatch, prayerData?.items, prayerFavKeys]);

  const changeFontSize = (delta: number) => {
    setFontSizePx((prev) => {
      const next = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, prev + delta));
      try {
        localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handlePrint = async (options: {
    includePrayerList: boolean;
    includePrayerLetters: boolean;
    fontSize: number;
  }) => {
    if (!options.includePrayerList && !options.includePrayerLetters) {
      alert("인쇄할 내용을 선택해 주세요.");
      return;
    }

    setIsPrinting(true);

    try {
      const imageMap = new Map<string, ImageItem[]>();

      if (options.includePrayerLetters) {
        await Promise.all(
          cards.map(async (card) => {
            if (!card.missionary?.folderId || !card.missionary.updatedAtMs) return;

            try {
              const res = await fetch(`/api/images?folderId=${encodeURIComponent(card.missionary.folderId)}`);
              const data = await res.json();
              if (!Array.isArray(data?.images)) return;

              const filtered = filterImagesByDate(data.images, card.missionary.updatedAtMs);
              if (filtered.length > 0) {
                imageMap.set(card.missionary.folderId, sortImagesByUpdatedDate(filtered));
              }
            } catch {
              // ignore
            }
          })
        );
      }

      const styleId = "print-styles";
      let styleEl = document.getElementById(styleId);
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }

      styleEl.textContent = `
        @media print {
          body > *:not(.print-content) {
            display: none !important;
          }
          .print-content {
            display: block !important;
            font-size: ${options.fontSize}px !important;
            line-height: 1.6 !important;
          }
          .print-prayer-letter-image {
            page-break-after: always;
            break-after: page;
            width: 100%;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 0;
          }
          .print-prayer-letter-image:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          .print-prayer-letter-image img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
          }
        }
      `;

      const printContent = document.createElement("div");
      printContent.className = "print-content";
      printContent.style.display = "none";

      for (const card of cards) {
        const missionary = card.missionary;
        const prayerItem = card.prayerItem;
        if (!missionary && !prayerItem) continue;

        const name = missionary?.name ?? prayerItem?.name ?? "(이름 없음)";
        const country = missionary?.country ?? prayerItem?.country ?? "";

        const cardDiv = document.createElement("div");
        cardDiv.style.marginBottom = "2rem";
        cardDiv.style.pageBreakInside = "avoid";

        if (options.includePrayerList || options.includePrayerLetters) {
          const nameDiv = document.createElement("div");
          nameDiv.style.fontWeight = "bold";
          nameDiv.style.marginBottom = "0.5rem";
          nameDiv.textContent = `${name}${country ? ` (${country})` : ""}`;
          cardDiv.appendChild(nameDiv);
        }

        if (options.includePrayerList && prayerItem?.prayerContent) {
          const prayerDiv = document.createElement("div");
          prayerDiv.style.marginBottom = "1rem";
          prayerDiv.style.whiteSpace = "pre-wrap";
          prayerDiv.textContent = prayerItem.prayerContent;
          cardDiv.appendChild(prayerDiv);
        }

        if (options.includePrayerLetters && missionary?.folderId) {
          const images = imageMap.get(missionary.folderId) ?? [];
          for (const image of images) {
            const imgDiv = document.createElement("div");
            imgDiv.className = "print-prayer-letter-image";

            const imgEl = document.createElement("img");
            imgEl.src = image.url.replace("sz=w2000", "sz=w4000");
            imgEl.alt = image.name || "기도편지";

            imgDiv.appendChild(imgEl);
            cardDiv.appendChild(imgDiv);
          }
        }

        printContent.appendChild(cardDiv);
      }

      document.body.appendChild(printContent);

      const images = printContent.querySelectorAll("img");
      await Promise.all(
        Array.from(images).map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) {
                resolve();
              } else {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              }
            })
        )
      );

      setTimeout(() => {
        window.print();
        setTimeout(() => {
          printContent.remove();
          styleEl?.remove();
          setIsPrinting(false);
        }, 100);
      }, 100);
    } catch {
      setIsPrinting(false);
    }
  };

  if (loading) {
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
              <h1 className="text-lg md:text-xl font-bold">즐겨찾기</h1>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-3 md:px-4 py-8 flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4" />
          <p className="text-gray-600 text-sm">불러오는 중...</p>
        </main>
      </div>
    );
  }

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
              <h1 className="text-lg md:text-xl font-bold">즐겨찾기</h1>
              <p className="text-blue-100 text-xs md:text-sm">
                지도와 기도 제목에서 저장한 선교사와 기도문을 한 곳에서 확인합니다.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 md:px-4 py-4 md:py-6 max-w-3xl">
        {cards.length === 0 ? (
          <div className="rounded-lg bg-white border border-gray-200 shadow-sm p-8 text-center">
            <p className="text-gray-600 mb-2">즐겨찾기 항목이 없습니다.</p>
            <p className="text-sm text-gray-500 mb-4">
              지도에서 선교사를 누르거나 기도 제목 페이지에서 별을 눌러 추가해 보세요.
            </p>
            <Link
              href="/"
              className="inline-block px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              지도 보기
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-600">글자 크기</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => changeFontSize(-1)}
                    disabled={fontSizePx <= MIN_FONT_SIZE}
                    className="w-9 h-9 rounded-lg border border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label="글자 크기 줄이기"
                  >
                    -
                  </button>
                  <span className="min-w-[3rem] text-center text-sm text-gray-600">{fontSizePx}px</span>
                  <button
                    type="button"
                    onClick={() => changeFontSize(1)}
                    disabled={fontSizePx >= MAX_FONT_SIZE}
                    className="w-9 h-9 rounded-lg border border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label="글자 크기 키우기"
                  >
                    +
                  </button>
                </div>
              </div>
              <PrintControls onPrint={handlePrint} isPrinting={isPrinting} />
            </div>

            <div className="space-y-4" style={{ fontSize: `${fontSizePx}px`, lineHeight: 1.6 }}>
              {cards.map((card, idx) => {
                const missionary = card.missionary;
                const prayerItem = card.prayerItem;
                const name = missionary?.name ?? prayerItem?.name ?? "(이름 없음)";
                const country = missionary?.country ?? prayerItem?.country ?? "";
                const isCCountry = country.trim() === "C국";
                const countryKey = resolveCountryKey(country, countryCenters);
                const iso2 = getCountryIso2(countryKey);

                return (
                  <article
                    key={missionary?.folderId ?? getPrayerFavoriteKey(prayerItem!) ?? idx}
                    className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isCCountry ? (
                          <span className="flex-shrink-0 w-6 h-5 rounded bg-red-600" aria-hidden />
                        ) : iso2 ? (
                          <span
                            className={`fi fi-${iso2}`}
                            style={{ display: "inline-block", width: 24, height: 18, flexShrink: 0 }}
                            aria-hidden
                          />
                        ) : null}
                        <h2 className="font-bold text-gray-900">{name}</h2>
                        {country ? <span className="text-gray-500">· {country}</span> : null}
                      </div>
                    </div>

                    {prayerItem?.prayerContent && (
                      <div className="px-4 py-3 bg-amber-50/50 border-b border-gray-100">
                        <h3 className="font-semibold text-amber-800 mb-1.5">이번 주 기도 제목</h3>
                        <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                          {prayerItem.prayerContent}
                        </div>
                        {prayerItem.reference && (
                          <p className="text-gray-500 mt-2">참고: {prayerItem.reference}</p>
                        )}
                      </div>
                    )}

                    <div className="px-4 py-3">
                      {missionary ? (
                        <Link
                          href={`/viewer/${missionary.folderId}`}
                          className="inline-flex items-center font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full py-2 px-4 hover:bg-blue-100 hover:border-blue-300 transition-colors"
                        >
                          기도편지 보기
                        </Link>
                      ) : (
                        <span className="text-gray-500">
                          기도편지 폴더가 없어 기도 제목만 표시하고 있습니다.
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
