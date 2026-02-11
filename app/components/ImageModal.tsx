"use client";

import { useEffect } from "react";

type ImageModalProps = {
  image: { fileId: string; name: string; url: string } | null;
  images: { fileId: string; name: string; url: string }[];
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  hasNext: boolean;
  hasPrev: boolean;
};

export default function ImageModal({
  image,
  images,
  onClose,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
}: ImageModalProps) {
  useEffect(() => {
    if (!image) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && hasNext) onNext();
      if (e.key === "ArrowLeft" && hasPrev) onPrev();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [image, hasNext, hasPrev, onClose, onNext, onPrev]);

  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative max-w-7xl max-h-full w-full h-full flex items-center justify-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white hover:text-gray-300 text-3xl font-bold bg-black/50 rounded-full w-10 h-10 flex items-center justify-center z-10"
          aria-label="닫기"
        >
          ×
        </button>

        {hasPrev && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPrev();
            }}
            className="absolute left-4 text-white hover:text-gray-300 text-4xl font-bold bg-black/50 rounded-full w-12 h-12 flex items-center justify-center z-10"
            aria-label="이전 이미지"
          >
            ‹
          </button>
        )}

        {hasNext && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            className="absolute right-4 text-white hover:text-gray-300 text-4xl font-bold bg-black/50 rounded-full w-12 h-12 flex items-center justify-center z-10"
            aria-label="다음 이미지"
          >
            ›
          </button>
        )}

        <div
          onClick={(e) => e.stopPropagation()}
          className="relative max-w-full max-h-full"
        >
          <img
            src={image.url}
            alt={image.name}
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-4 rounded-b-lg">
            <p className="text-sm">{image.name}</p>
            <p className="text-xs text-gray-300 mt-1">
              {images.findIndex((img) => img.fileId === image.fileId) + 1} / {images.length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
