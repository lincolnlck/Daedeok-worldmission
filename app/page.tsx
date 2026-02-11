"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { countryCenters } from "./data/countryCenters";
import Header from "./components/Header";
import ImageModal from "./components/ImageModal";
import StatsDashboard from "./components/StatsDashboard";

type ApiItem = {
  folderId: string;
  folderName: string;
  name: string;
  country: string;
  ministry: string;
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

  useEffect(() => {
    setLoadingItems(true);
    fetch("/api/missionaries")
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch((err) => {
        console.error("Failed to load missionaries:", err);
        setItems([]);
      })
      .finally(() => setLoadingItems(false));
  }, []);

  const mapped: MissionaryItem[] = useMemo(() => {
    return items.map((m) => {
      const center = countryCenters[m.country] ?? { lat: 20, lng: 0 };
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

  const stats = useMemo(() => {
    const uniqueCountries = new Set(mapped.map((m) => m.country).filter(Boolean));
    return {
      totalMissionaries: mapped.length,
      totalCountries: uniqueCountries.size,
      visibleCount: filtered.length,
    };
  }, [mapped, filtered]);

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

      {/* 선교사 목록 */}
      <div className="mb-4">
        <h3 className="text-xs md:text-sm font-semibold text-gray-700 mb-2">선교사 목록</h3>
        <div className="space-y-1.5 md:space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <p className="text-sm">검색 결과가 없습니다</p>
            </div>
          ) : (
            filtered.slice(0, 50).map((m) => (
              <button
                key={m.folderId}
                className={`w-full text-left rounded-lg px-3 py-2.5 border transition-all touch-manipulation active:scale-[0.98] ${
                  selected?.folderId === m.folderId
                    ? "bg-blue-50 border-blue-300 shadow-sm"
                    : "bg-white border-gray-200 active:bg-gray-50 active:border-gray-300"
                }`}
                onClick={() => router.push(`/viewer/${m.folderId}`)}
              >
                <div className="font-semibold text-gray-900 text-sm md:text-base">{m.name} 선교사</div>
                <div className="text-xs text-gray-600 mt-0.5">{m.country || "국가 미지정"}</div>
              </button>
            ))
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
          {/* 사이드바 - 왼쪽 (고정 너비, 내부 스크롤) */}
          <aside className="w-[420px] flex-shrink-0 border-r bg-white overflow-y-auto p-4">
            {sidebarContent}
          </aside>

          {/* 지도 - 오른쪽 (나머지 공간 전부, 높이 고정) */}
          <div className="flex-1 relative">
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
