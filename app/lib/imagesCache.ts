/**
 * 클라이언트 이미지 목록 캐시 (sessionStorage + fetch)
 * - 같은 폴더 재진입 시 API 생략으로 로딩 속도 개선
 */

const CACHE_KEY_PREFIX = "mission-prayer-images-";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5분

export type ImageItem = { fileId: string; name: string; url: string };

type CachedEntry = { images: ImageItem[]; expiresAt: number };

function getCacheKey(folderId: string): string {
  return `${CACHE_KEY_PREFIX}${folderId}`;
}

export function getCachedImages(folderId: string): ImageItem[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(getCacheKey(folderId));
    if (!raw) return null;
    const entry: CachedEntry = JSON.parse(raw);
    if (entry.expiresAt < Date.now()) return null;
    return entry.images ?? null;
  } catch {
    return null;
  }
}

export function setCachedImages(folderId: string, images: ImageItem[]): void {
  if (typeof window === "undefined") return;
  try {
    const entry: CachedEntry = {
      images,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    sessionStorage.setItem(getCacheKey(folderId), JSON.stringify(entry));
  } catch {
    // ignore
  }
}

/**
 * 캐시가 유효하면 캐시 반환, 아니면 /api/images 호출 후 캐시 저장 및 반환
 */
export async function fetchImages(folderId: string): Promise<{ images: ImageItem[] }> {
  const cached = getCachedImages(folderId);
  if (cached) return { images: cached };

  const res = await fetch(`/api/images?folderId=${encodeURIComponent(folderId)}`);
  const data = await res.json();
  const imageList = data.images ?? [];
  setCachedImages(folderId, imageList);
  return { images: imageList };
}
