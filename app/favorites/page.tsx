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
  const d = new Date(timestampMs);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function filterImagesByDate(images: ImageItem[], targetDateMs: number): ImageItem[] {
  const targetDateStr = getDateString(targetDateMs);
  return images.filter((img) => getDateString(img.updatedAtMs) === targetDateStr);
}

// 파일명에서 날짜 추출 함수 (뷰어와 동일)
function extractDateFromName(name: string): Date | null {
  const datePattern1 = /(\d{4})-(\d{2})-(\d{2})/;
  const datePattern2 = /(\d{4})(\d{2})(\d{2})/;
  const datePattern3 = /(\d{4})\.(\d{2})\.(\d{2})/;
  
  let match = name.match(datePattern1) || name.match(datePattern3);
  if (match) {
    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  }
  
  match = name.match(datePattern2);
  if (match) {
    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  }
  
  return null;
}

// 파일명 끝에서 숫자 추출 (뷰어와 동일)
function extractTrailingNumber(name: string): number {
  const withoutExt = name.replace(/\.[^.]+$/, "");
  const match = withoutExt.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

// 이미지 정렬 (뷰어와 동일한 로직)
function sortImages(images: ImageItem[]): ImageItem[] {
  return [...images].sort((a, b) => {
    const dateA = extractDateFromName(a.name);
    const dateB = extractDateFromName(b.name);

    // 날짜가 있는 파일이 없는 파일보다 먼저
    if (dateA && !dateB) return -1;
    if (!dateA && dateB) return 1;

    // 둘 다 날짜가 있으면 최신순 (내림차순)
    if (dateA && dateB) {
      const diff = dateB.getTime() - dateA.getTime();
      if (diff !== 0) return diff;
    }

    // 같은 날짜(또는 둘 다 날짜 없음)면 파일명 끝 숫자 오름차순
    const numA = extractTrailingNumber(a.name);
    const numB = extractTrailingNumber(b.name);
    if (numA !== numB) return numA - numB;

    // 숫자도 같으면 파일명 알파벳순
    return a.name.localeCompare(b.name);
  });
}

function getPrayerFavoriteKey(item: PrayerListItem): string {
  return `${item.name ?? ""}|${item.country ?? ""}`;
}

export default function FavoritesPage() {
  const [missionaries, setMissionaries] = useState<MissionaryFromApi[]>([]);
  const [prayerData, setPrayerData] = useState<{
    success: boolean;
    items: PrayerListItem[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mainFavIds, setMainFavIds] = useState<Set<string>>(new Set());
  const [prayerFavKeys, setPrayerFavKeys] = useState<Set<string>>(new Set());
  const [fontSizePx, setFontSizePx] = useState(DEFAULT_FONT_SIZE);
  const [cardImages, setCardImages] = useState<Map<string, ImageItem[]>>(new Map());
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    try {
      const mainRaw = localStorage.getItem(MAIN_FAVORITES_KEY);
      const mainArr = mainRaw ? (JSON.parse(mainRaw) as string[]) : [];
      setMainFavIds(new Set(Array.isArray(mainArr) ? mainArr : []));

      const prayerRaw = localStorage.getItem(PRAYER_LIST_FAVORITES_KEY);
      const prayerArr = prayerRaw ? (JSON.parse(prayerRaw) as string[]) : [];
      setPrayerFavKeys(new Set(Array.isArray(prayerArr) ? prayerArr : []));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
      if (saved != null) {
        const n = parseInt(saved, 10);
        if (Number.isFinite(n) && n >= MIN_FONT_SIZE && n <= MAX_FONT_SIZE) {
          setFontSizePx(n);
        }
      }
    } catch {
      // ignore
    }
  }, []);

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

  useEffect(() => {
    Promise.all([
      fetch("/api/missionaries").then((r) => r.json()),
      fetch("/api/prayer-list").then((r) => r.json()),
    ])
      .then(([missionaryRes, prayerRes]) => {
        const list = Array.isArray(missionaryRes?.items) ? missionaryRes.items : [];
        setMissionaries(list);
        setPrayerData(
          prayerRes?.success && prayerRes?.items
            ? { success: true, items: prayerRes.items }
            : null
        );
      })
      .catch(() => {
        setMissionaries([]);
        setPrayerData(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const missionaryForMatch = useMemo(
    () => missionaries.map((m) => ({ name: m.name, folderId: m.folderId })),
    [missionaries]
  );

  const cards = useMemo(() => {
    const list: FavoriteCard[] = [];
    const byFolderId = new Map<string, FavoriteCard>();
    const prayerItems = prayerData?.items ?? [];

    // 1) 메인 즐겨찾기 선교사 → 카드 추가
    for (const m of missionaries) {
      if (!mainFavIds.has(m.folderId)) continue;
      const prayerItem =
        prayerItems.find(
          (p) => matchMissionaryByName(missionaryForMatch, p.name) === m.folderId
        ) ?? null;
      const card: FavoriteCard = { missionary: m, prayerItem };
      list.push(card);
      byFolderId.set(m.folderId, card);
    }

    // 2) 기도 제목 즐겨찾기 → 아직 없는 경우만 카드 추가
    for (const item of prayerItems) {
      if (!prayerFavKeys.has(getPrayerFavoriteKey(item))) continue;
      const folderId = matchMissionaryByName(missionaryForMatch, item.name);
      if (folderId && byFolderId.has(folderId)) {
        const existing = byFolderId.get(folderId)!;
        if (!existing.prayerItem) existing.prayerItem = item;
        continue;
      }
      if (folderId) {
        const m = missionaries.find((x) => x.folderId === folderId) ?? null;
        if (m) {
          const card: FavoriteCard = { missionary: m, prayerItem: item };
          list.push(card);
          byFolderId.set(folderId, card);
          continue;
        }
      }
      list.push({ missionary: null, prayerItem: item });
    }

    // 이름순 정렬
    list.sort((a, b) => {
      const nameA = a.missionary?.name ?? a.prayerItem?.name ?? "";
      const nameB = b.missionary?.name ?? b.prayerItem?.name ?? "";
      return nameA.localeCompare(nameB, "ko");
    });

    return list;
  }, [
    missionaries,
    prayerData?.items,
    mainFavIds,
    prayerFavKeys,
    missionaryForMatch,
  ]);

  const handlePrint = async (options: {
    includePrayerList: boolean;
    includePrayerLetters: boolean;
    fontSize: number;
  }) => {
    if (!options.includePrayerList && !options.includePrayerLetters) {
      alert("인쇄할 내용을 선택해주세요.");
      return;
    }

    setIsPrinting(true);

    try {
    const newCardImages = new Map<string, ImageItem[]>();
    if (options.includePrayerLetters) {
      const imagePromises: Promise<void>[] = [];

      for (const card of cards) {
        if (!card.missionary?.folderId || !card.missionary.updatedAtMs) continue;
        const folderId = card.missionary.folderId;
        const updatedAtMs = card.missionary.updatedAtMs;

        imagePromises.push(
          fetch(`/api/images?folderId=${encodeURIComponent(folderId)}`)
            .then((r) => r.json())
            .then((data) => {
              if (Array.isArray(data?.images)) {
                const filtered = filterImagesByDate(data.images, updatedAtMs);
                if (filtered.length > 0) {
                  // 뷰어와 동일한 정렬 적용
                  const sorted = sortImages(filtered);
                  newCardImages.set(folderId, sorted);
                }
              }
            })
            .catch(() => {
              // ignore errors
            })
        );
      }

      await Promise.all(imagePromises);
      setCardImages(newCardImages);
    }

    // 인쇄 스타일 주입
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
        }
        .print-content {
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

    // 인쇄용 콘텐츠 생성
    const printContent = document.createElement("div");
    printContent.className = "print-content";
    printContent.style.display = "none";

    for (const card of cards) {
      const m = card.missionary;
      const p = card.prayerItem;
      if (!m && !p) continue;

      const name = m?.name ?? p?.name ?? "(이름 없음)";
      const country = m?.country ?? p?.country ?? "";

      const cardDiv = document.createElement("div");
      cardDiv.style.marginBottom = "2rem";
      cardDiv.style.pageBreakInside = "avoid";

      // 이름/국가
      if (options.includePrayerList || options.includePrayerLetters) {
        const nameDiv = document.createElement("div");
        nameDiv.style.fontWeight = "bold";
        nameDiv.style.marginBottom = "0.5rem";
        nameDiv.textContent = `${name}${country ? ` (${country})` : ""}`;
        cardDiv.appendChild(nameDiv);
      }

      // 기도 제목
      if (options.includePrayerList && p?.prayerContent) {
        const prayerDiv = document.createElement("div");
        prayerDiv.style.marginBottom = "1rem";
        prayerDiv.style.whiteSpace = "pre-wrap";
        prayerDiv.textContent = p.prayerContent;
        cardDiv.appendChild(prayerDiv);
      }

      // 기도편지 이미지
      if (options.includePrayerLetters && m?.folderId) {
        const images = newCardImages.get(m.folderId) ?? [];
        if (images.length > 0) {
          for (const img of images) {
            const imgDiv = document.createElement("div");
            imgDiv.className = "print-prayer-letter-image";
            const imgEl = document.createElement("img");
            const imageUrl = img.url.replace("sz=w2000", "sz=w4000");
            imgEl.src = imageUrl;
            imgEl.alt = img.name || "기도편지";
            imgDiv.appendChild(imgEl);
            cardDiv.appendChild(imgDiv);
          }
        }
      }

      printContent.appendChild(cardDiv);
    }

    document.body.appendChild(printContent);

    // 이미지 로드 완료 대기
    const images = printContent.querySelectorAll("img");
    const imageLoadPromises = Array.from(images).map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
          } else {
            img.onload = () => resolve();
            img.onerror = () => resolve(); // 에러가 나도 계속 진행
          }
        })
    );

    await Promise.all(imageLoadPromises);

    // 인쇄 실행
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        printContent.remove();
        if (styleEl) styleEl.remove();
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
                지도·기도 제목에서 찜한 선교사님을 한곳에서 보기
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 md:px-4 py-4 md:py-6 max-w-3xl">
        {cards.length === 0 ? (
          <div className="rounded-lg bg-white border border-gray-200 shadow-sm p-8 text-center">
            <p className="text-gray-600 mb-2">즐겨찾기한 항목이 없습니다.</p>
            <p className="text-sm text-gray-500 mb-4">
              지도에서 선교사 옆 ⭐를 누르거나, 기도 제목 탭에서 ⭐를 눌러 추가해 보세요.
            </p>
            <Link
              href="/"
              className="inline-block px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              지도로 이동
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
                    −
                  </button>
                  <span className="min-w-[3rem] text-center text-sm text-gray-600">
                    {fontSizePx}px
                  </span>
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
            <div
              className="space-y-4"
              style={{ fontSize: `${fontSizePx}px`, lineHeight: 1.6 }}
            >
            {cards.map((card, idx) => {
              const m = card.missionary;
              const p = card.prayerItem;
              const name = m?.name ?? p?.name ?? "(이름 없음)";
              const country = m?.country ?? p?.country ?? "";
              const isCCountry = country?.trim() === "C국";
              const countryKey = resolveCountryKey(country, countryCenters);
              const iso2 = getCountryIso2(countryKey);

              return (
                <article
                  key={m?.folderId ?? getPrayerFavoriteKey(p!) ?? idx}
                  className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isCCountry ? (
                        <span
                          className="flex-shrink-0 w-6 h-5 rounded bg-red-600"
                          aria-hidden
                        />
                      ) : iso2 ? (
                        <span
                          className={`fi fi-${iso2}`}
                          style={{
                            display: "inline-block",
                            width: 24,
                            height: 18,
                            flexShrink: 0,
                          }}
                          aria-hidden
                        />
                      ) : null}
                      <h2 className="font-bold text-gray-900">
                        {name}
                      </h2>
                      {country ? (
                        <span className="text-gray-500">📍 {country}</span>
                      ) : null}
                    </div>
                  </div>

                  {p?.prayerContent && (
                    <div className="px-4 py-3 bg-amber-50/50 border-b border-gray-100">
                      <h3 className="font-semibold text-amber-800 mb-1.5">
                        이번 주 기도 제목
                      </h3>
                      <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {p.prayerContent}
                      </div>
                      {p.reference && (
                        <p className="text-gray-500 mt-2">참고: {p.reference}</p>
                      )}
                    </div>
                  )}

                  <div className="px-4 py-3">
                    {m ? (
                      <Link
                        href={`/viewer/${m.folderId}`}
                        className="inline-flex items-center font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full py-2 px-4 hover:bg-blue-100 hover:border-blue-300 transition-colors"
                      >
                        기도편지 보기
                      </Link>
                    ) : (
                      <span className="text-gray-500">
                        기도편지 폴더가 없습니다. 기도 제목만 표시 중입니다.
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
