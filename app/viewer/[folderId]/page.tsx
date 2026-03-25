"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchImages, type ImageItem } from "@/app/lib/imagesCache";

function extractTrailingNumber(name: string): number {
  const withoutExt = name.replace(/\.[^.]+$/, "");
  const match = withoutExt.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

function sortImages(images: ImageItem[]): ImageItem[] {
  return [...images].sort((a, b) => {
    const primaryDateA = a.createdAtMs ?? a.updatedAtMs ?? 0;
    const primaryDateB = b.createdAtMs ?? b.updatedAtMs ?? 0;
    const dateA = primaryDateA ? new Date(primaryDateA) : null;
    const dateB = primaryDateB ? new Date(primaryDateB) : null;

    if (dateA) dateA.setHours(0, 0, 0, 0);
    if (dateB) dateB.setHours(0, 0, 0, 0);

    const dayA = dateA?.getTime() ?? 0;
    const dayB = dateB?.getTime() ?? 0;
    if (dayA !== dayB) return dayB - dayA;

    const numA = extractTrailingNumber(a.name);
    const numB = extractTrailingNumber(b.name);
    if (numA !== numB) return numA - numB;

    const primaryDiff = primaryDateA - primaryDateB;
    if (primaryDiff !== 0) return primaryDiff;

    return a.name.localeCompare(b.name, "ko");
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

  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((value) => Math.min(value + 0.5, 5));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((value) => {
      const next = Math.max(value - 0.5, 1);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const goToIndex = useCallback(
    (nextIndex: number) => {
      setCurrentIndex(nextIndex);
      resetZoom();
    },
    [resetZoom]
  );

  const nextImage = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev >= images.length - 1) return prev;
      resetZoom();
      return prev + 1;
    });
  }, [images.length, resetZoom]);

  const prevImage = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev <= 0) return prev;
      resetZoom();
      return prev - 1;
    });
  }, [resetZoom]);

  useEffect(() => {
    if (images.length === 0) return;

    const prevIdx = currentIndex - 1;
    const nextIdx = currentIndex + 1;

    if (prevIdx >= 0 && images[prevIdx]?.url) {
      const img = new Image();
      img.src = images[prevIdx].url;
    }

    if (nextIdx < images.length && images[nextIdx]?.url) {
      const img = new Image();
      img.src = images[nextIdx].url;
    }
  }, [currentIndex, images]);

  useEffect(() => {
    const container = imageContainerRef.current;
    if (!container) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.deltaY < 0) {
        setZoom((value) => Math.min(value + 0.25, 5));
      } else {
        setZoom((value) => {
          const next = Math.max(value - 0.25, 1);
          if (next === 1) setPosition({ x: 0, y: 0 });
          return next;
        });
      }
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (!folderId) return;

    let cancelled = false;

    Promise.all([fetch("/api/missionaries").then((r) => r.json()), fetchImages(folderId)])
      .then(([missionariesData, { images: imageList }]) => {
        if (cancelled) return;

        const missionary = missionariesData.items?.find(
          (item: { folderId: string }) => item.folderId === folderId
        );
        setMissionaryName(missionary?.name || missionary?.folderName || "");
        setImages(sortImages(imageList));
        setCurrentIndex(0);
        resetZoom();
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load images:", err);
        setImages([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [folderId, resetZoom]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") nextImage();
      if (event.key === "ArrowLeft") prevImage();
      if (event.key === "Escape") router.push("/");
      if (event.key === "+" || event.key === "=") zoomIn();
      if (event.key === "-") zoomOut();
      if (event.key === "0") resetZoom();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextImage, prevImage, resetZoom, router, zoomIn, zoomOut]);

  const onMouseDown = (event: React.MouseEvent) => {
    if (zoom <= 1) return;
    event.preventDefault();
    setIsDragging(true);
    setDragStart({ x: event.clientX - position.x, y: event.clientY - position.y });
  };

  const onMouseMove = (event: React.MouseEvent) => {
    if (!isDragging || zoom <= 1) return;
    setPosition({ x: event.clientX - dragStart.x, y: event.clientY - dragStart.y });
  };

  const onMouseUp = () => setIsDragging(false);

  const onTouchStart = (event: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(event.targetTouches[0].clientX);
  };

  const onTouchMove = (event: React.TouchEvent) => {
    setTouchEnd(event.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    if (distance > 50) nextImage();
    if (distance < -50) prevImage();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center text-white">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4" />
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
          <p className="text-lg md:text-xl mb-2">아직 기도편지가 없습니다.</p>
          <button
            onClick={() => router.push("/")}
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
      <div className="bg-black/90 backdrop-blur-sm text-white px-3 md:px-6 py-2 md:py-3 flex items-center justify-between z-10 flex-shrink-0">
        <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
          <button
            onClick={() => router.push("/")}
            className="text-white hover:text-gray-300 text-lg md:text-xl font-bold bg-black/50 rounded-full w-9 h-9 md:w-10 md:h-10 flex items-center justify-center transition-colors hover:bg-black/70 flex-shrink-0"
            aria-label="홈으로 이동"
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
          onClick={() => router.push("/")}
          className="text-white hover:text-gray-300 text-xl md:text-2xl font-bold bg-black/50 rounded-full w-9 h-9 md:w-10 md:h-10 flex items-center justify-center transition-colors hover:bg-black/70 flex-shrink-0"
          aria-label="닫기"
        >
          ×
        </button>
      </div>

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
        {currentIndex > 0 && (
          <button
            onClick={prevImage}
            className="absolute left-2 md:left-4 text-white hover:text-gray-300 text-3xl md:text-5xl font-bold bg-black/60 rounded-full w-12 h-12 md:w-16 md:h-16 flex items-center justify-center z-10 transition-all hover:bg-black/80 active:bg-black/90 touch-manipulation"
            aria-label="이전 이미지"
          >
            ‹
          </button>
        )}

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

        {currentIndex < images.length - 1 && (
          <button
            onClick={nextImage}
            className="absolute right-2 md:right-4 text-white hover:text-gray-300 text-3xl md:text-5xl font-bold bg-black/60 rounded-full w-12 h-12 md:w-16 md:h-16 flex items-center justify-center z-10 transition-all hover:bg-black/80 active:bg-black/90 touch-manipulation"
            aria-label="다음 이미지"
          >
            ›
          </button>
        )}

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
            -
          </button>
          <div className="w-[60px] h-[60px] md:w-[66px] md:h-[66px] flex items-center justify-center">
            {zoom > 1 && (
              <button
                onClick={resetZoom}
                className="w-full h-full bg-black/70 text-white rounded-xl flex items-center justify-center text-sm font-bold hover:bg-black/90 active:bg-white/20 transition-colors touch-manipulation"
                aria-label="원래 크기"
              >
                1:1
              </button>
            )}
          </div>
        </div>

        {zoom > 1 && (
          <div className="absolute top-3 right-3 bg-black/70 text-white text-xs px-2 py-1 rounded z-20">
            {Math.round(zoom * 100)}%
          </div>
        )}
      </div>

      <div className="bg-black/90 backdrop-blur-sm text-white px-3 md:px-6 py-2 md:py-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-3 max-w-4xl mx-auto">
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
              이전
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
              다음
            </button>
          </div>

          <div className="flex gap-1.5 overflow-x-auto max-w-[60%] md:max-w-md scrollbar-hide">
            {images.map((image, idx) => (
              <button
                key={image.fileId}
                onClick={() => goToIndex(idx)}
                className={`flex-shrink-0 w-10 h-10 md:w-14 md:h-14 rounded overflow-hidden border-2 transition-all touch-manipulation ${
                  idx === currentIndex
                    ? "border-white scale-110"
                    : "border-gray-600 opacity-60 active:opacity-100"
                }`}
              >
                <img
                  src={image.url}
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
