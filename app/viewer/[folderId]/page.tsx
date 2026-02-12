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

// 파일명 끝에서 숫자 추출 (예: page1.jpg → 1, 기도편지_03.png → 3)
function extractTrailingNumber(name: string): number {
  // 확장자 제거
  const withoutExt = name.replace(/\.[^.]+$/, "");
  // 끝에 있는 숫자 추출
  const match = withoutExt.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

// 정렬: 1차 최신 날짜순, 2차 파일명 끝 숫자 오름차순
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

  // 줌 관련 상태
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const zoomIn = () => setZoom((z) => Math.min(z + 0.5, 5));
  const zoomOut = () => {
    setZoom((z) => {
      const next = Math.max(z - 0.5, 1);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };
  const zoomReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  // 이미지 바뀌면 줌 리셋
  useEffect(() => {
    zoomReset();
  }, [currentIndex]);

  // 마우스 휠로 확대/축소
  useEffect(() => {
    const container = imageContainerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        setZoom((z) => Math.min(z + 0.25, 5));
      } else {
        setZoom((z) => {
          const next = Math.max(z - 0.25, 1);
          if (next === 1) setPosition({ x: 0, y: 0 });
          return next;
        });
      }
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, []);

  // 마우스 드래그 (확대 상태에서 이미지 이동)
  const onMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoom <= 1) return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const onMouseUp = () => setIsDragging(false);

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
        setImages(sortImages(imageList));
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
      if (e.key === "+" || e.key === "=") zoomIn();
      if (e.key === "-") zoomOut();
      if (e.key === "0") zoomReset();
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
        className="flex-1 min-h-0 flex items-center justify-center relative px-2 md:px-4 py-1 overflow-hidden"
        onTouchStart={zoom <= 1 ? onTouchStart : undefined}
        onTouchMove={zoom <= 1 ? onTouchMove : undefined}
        onTouchEnd={zoom <= 1 ? onTouchEnd : undefined}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{ cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
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

        {/* 이미지 - 줌 적용 */}
        <img
          src={currentImage.url}
          alt={currentImage.name}
          className="max-w-full max-h-full object-contain select-none transition-transform duration-150"
          style={{
            transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
          }}
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

        {/* 줌 컨트롤 버튼: +/− 위치 고정, 1:1은 항상 아래 칸에 표시 */}
        <div className="absolute bottom-3 right-3 md:bottom-4 md:right-4 flex flex-col gap-1.5 z-20">
          <button
            onClick={zoomIn}
            className="w-[60px] h-[60px] md:w-[66px] md:h-[66px] bg-black/70 text-white rounded-xl flex items-center justify-center text-3xl font-bold hover:bg-black/90 active:bg-white/20 transition-colors touch-manipulation"
            aria-label="확대"
          >
            +
          </button>
          <button
            onClick={zoomOut}
            disabled={zoom <= 1}
            className={`w-[60px] h-[60px] md:w-[66px] md:h-[66px] bg-black/70 rounded-xl flex items-center justify-center text-3xl font-bold transition-colors touch-manipulation ${
              zoom <= 1 ? "text-gray-600 cursor-not-allowed" : "text-white hover:bg-black/90 active:bg-white/20"
            }`}
            aria-label="축소"
          >
            −
          </button>
          {/* 1:1 버튼 자리 항상 확보 → +/− 위치 고정, zoom>1일 때만 버튼 표시 */}
          <div className="w-[60px] h-[60px] md:w-[66px] md:h-[66px] flex items-center justify-center">
            {zoom > 1 && (
              <button
                onClick={zoomReset}
                className="w-full h-full bg-black/70 text-white rounded-xl flex items-center justify-center text-sm font-bold hover:bg-black/90 active:bg-white/20 transition-colors touch-manipulation"
                aria-label="원래 크기"
              >
                1:1
              </button>
            )}
          </div>
        </div>

        {/* 줌 레벨 표시 */}
        {zoom > 1 && (
          <div className="absolute top-3 right-3 bg-black/70 text-white text-xs px-2 py-1 rounded z-20">
            {Math.round(zoom * 100)}%
          </div>
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
