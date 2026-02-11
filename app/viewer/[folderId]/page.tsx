"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

type ImageItem = { fileId: string; name: string; url: string };

// 파일명에서 날짜 추출 함수
function extractDateFromName(name: string): Date | null {
  // YYYY-MM-DD 형식
  const datePattern1 = /(\d{4})-(\d{2})-(\d{2})/;
  // YYYYMMDD 형식
  const datePattern2 = /(\d{4})(\d{2})(\d{2})/;
  // YYYY.MM.DD 형식
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

export default function ImageViewerPage() {
  const params = useParams();
  const router = useRouter();
  const folderId = params.folderId as string;
  
  const [images, setImages] = useState<ImageItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [missionaryName, setMissionaryName] = useState("");
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // 최소 스와이프 거리 (픽셀)
  const minSwipeDistance = 50;

  useEffect(() => {
    if (!folderId) return;

    // 선교사 정보 가져오기
    fetch("/api/missionaries")
      .then((r) => r.json())
      .then((d) => {
        const missionary = d.items?.find((item: any) => item.folderId === folderId);
        if (missionary) {
          setMissionaryName(missionary.name || missionary.folderName || "");
        }
      })
      .catch(() => {});

    // 이미지 가져오기
    setLoading(true);
    fetch(`/api/images?folderId=${encodeURIComponent(folderId)}`)
      .then((r) => r.json())
      .then((d) => {
        const imageList = d.images ?? [];
        // 최신순으로 정렬
        const sortedImages = [...imageList].sort((a, b) => {
          const dateA = extractDateFromName(a.name);
          const dateB = extractDateFromName(b.name);
          
          if (dateA && dateB) {
            return dateB.getTime() - dateA.getTime();
          }
          
          return 0;
        }).reverse();
        
        setImages(sortedImages);
        setCurrentIndex(0);
      })
      .catch((err) => {
        console.error("Failed to load images:", err);
        setImages([]);
      })
      .finally(() => setLoading(false));
  }, [folderId]);

  const nextImage = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const prevImage = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // 터치 이벤트 핸들러
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      nextImage();
    }
    if (isRightSwipe) {
      prevImage();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") nextImage();
      if (e.key === "ArrowLeft") prevImage();
      if (e.key === "Escape") router.push('/');
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, images.length, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center text-white">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
          <p className="text-sm md:text-base">기도편지를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center text-white">
          <div className="text-4xl mb-4">📭</div>
          <p className="text-lg md:text-xl mb-2">아직 선교지에서 기도편지가 도착하지 않았습니다🙏</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors text-sm md:text-base"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const currentImage = images[currentIndex];

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="bg-black/90 backdrop-blur-sm text-white px-3 md:px-6 py-2 md:py-3 flex items-center justify-between z-10 flex-shrink-0">
        <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
          <button
            onClick={() => router.push('/')}
            className="text-white hover:text-gray-300 text-lg md:text-xl font-bold bg-black/50 rounded-full w-9 h-9 md:w-10 md:h-10 flex items-center justify-center transition-colors hover:bg-black/70 flex-shrink-0"
            aria-label="뒤로 가기"
          >
            ←
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base md:text-xl font-bold truncate">{missionaryName || "기도편지"}</h1>
            <p className="text-xs md:text-sm text-gray-300">
              {currentIndex + 1} / {images.length}
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push('/')}
          className="text-white hover:text-gray-300 text-xl md:text-2xl font-bold bg-black/50 rounded-full w-9 h-9 md:w-10 md:h-10 flex items-center justify-center transition-colors hover:bg-black/70 flex-shrink-0"
          aria-label="홈으로 돌아가기"
        >
          ×
        </button>
      </div>

      {/* 이미지 영역 - 남은 공간 전체 사용 */}
      <div 
        ref={imageContainerRef}
        className="flex-1 min-h-0 flex items-center justify-center relative px-2 md:px-4 py-1"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* 이전 버튼 */}
        {currentIndex > 0 && (
          <button
            onClick={prevImage}
            className="absolute left-2 md:left-4 text-white hover:text-gray-300 text-3xl md:text-5xl font-bold bg-black/60 rounded-full w-12 h-12 md:w-16 md:h-16 flex items-center justify-center z-10 transition-all hover:bg-black/80 active:bg-black/90 touch-manipulation"
            aria-label="이전 이미지"
          >
            ‹
          </button>
        )}

        {/* 이미지 - 영역 안에 꽉 맞춤 */}
        <img
          src={currentImage.url}
          alt={currentImage.name}
          className="max-w-full max-h-full object-contain select-none"
          draggable={false}
          onError={() => {
            console.error("Image load error:", currentImage.url);
          }}
        />

        {/* 다음 버튼 */}
        {currentIndex < images.length - 1 && (
          <button
            onClick={nextImage}
            className="absolute right-2 md:right-4 text-white hover:text-gray-300 text-3xl md:text-5xl font-bold bg-black/60 rounded-full w-12 h-12 md:w-16 md:h-16 flex items-center justify-center z-10 transition-all hover:bg-black/80 active:bg-black/90 touch-manipulation"
            aria-label="다음 이미지"
          >
            ›
          </button>
        )}
      </div>

      {/* 하단 네비게이션 */}
      <div className="bg-black/90 backdrop-blur-sm text-white px-3 md:px-6 py-2 md:py-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-3 max-w-4xl mx-auto">
          {/* 이전/다음 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={prevImage}
              disabled={currentIndex === 0}
              className={`px-4 py-2 rounded-lg transition-all text-sm touch-manipulation ${
                currentIndex === 0
                  ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                  : "bg-white/20 text-white active:bg-white/30"
              }`}
            >
              ← 이전
            </button>
            <button
              onClick={nextImage}
              disabled={currentIndex === images.length - 1}
              className={`px-4 py-2 rounded-lg transition-all text-sm touch-manipulation ${
                currentIndex === images.length - 1
                  ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                  : "bg-white/20 text-white active:bg-white/30"
              }`}
            >
              다음 →
            </button>
          </div>

          {/* 썸네일 인디케이터 */}
          <div className="flex gap-1.5 overflow-x-auto max-w-[60%] md:max-w-md scrollbar-hide">
            {images.map((img, idx) => (
              <button
                key={img.fileId}
                onClick={() => setCurrentIndex(idx)}
                className={`flex-shrink-0 w-10 h-10 md:w-14 md:h-14 rounded overflow-hidden border-2 transition-all touch-manipulation ${
                  idx === currentIndex
                    ? "border-white scale-110"
                    : "border-gray-600 opacity-60 active:opacity-100"
                }`}
              >
                <img
                  src={img.url}
                  alt={`${idx + 1}`}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
