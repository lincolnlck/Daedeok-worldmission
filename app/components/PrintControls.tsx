"use client";

import { useState, useEffect } from "react";

const PRINT_FONT_SIZE_STORAGE_KEY = "mission-prayer-print-font-size";
const PRINT_INCLUDE_PRAYER_LIST_KEY = "mission-prayer-print-include-prayer-list";
const PRINT_INCLUDE_PRAYER_LETTERS_KEY = "mission-prayer-print-include-prayer-letters";
const MIN_PRINT_FONT_SIZE = 12;
const MAX_PRINT_FONT_SIZE = 28;
const DEFAULT_PRINT_FONT_SIZE = 13;

type PrintControlsProps = {
  onPrint: (options: {
    includePrayerList: boolean;
    includePrayerLetters: boolean;
    fontSize: number;
  }) => void;
};

export default function PrintControls({ onPrint }: PrintControlsProps) {
  const [printIncludePrayerList, setPrintIncludePrayerList] = useState(true);
  const [printIncludePrayerLetters, setPrintIncludePrayerLetters] = useState(false);
  const [printFontSizePx, setPrintFontSizePx] = useState(DEFAULT_PRINT_FONT_SIZE);

  useEffect(() => {
    try {
      const savedFontSize = localStorage.getItem(PRINT_FONT_SIZE_STORAGE_KEY);
      if (savedFontSize != null) {
        const n = parseInt(savedFontSize, 10);
        if (Number.isFinite(n) && n >= MIN_PRINT_FONT_SIZE && n <= MAX_PRINT_FONT_SIZE) {
          setPrintFontSizePx(n);
        }
      }

      const savedPrayerList = localStorage.getItem(PRINT_INCLUDE_PRAYER_LIST_KEY);
      if (savedPrayerList === "false") {
        setPrintIncludePrayerList(false);
      }

      const savedPrayerLetters = localStorage.getItem(PRINT_INCLUDE_PRAYER_LETTERS_KEY);
      if (savedPrayerLetters === "true") {
        setPrintIncludePrayerLetters(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const changePrintFontSize = (delta: number) => {
    setPrintFontSizePx((prev) => {
      const next = Math.min(MAX_PRINT_FONT_SIZE, Math.max(MIN_PRINT_FONT_SIZE, prev + delta));
      try {
        localStorage.setItem(PRINT_FONT_SIZE_STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handlePrayerListToggle = () => {
    const next = !printIncludePrayerList;
    setPrintIncludePrayerList(next);
    try {
      localStorage.setItem(PRINT_INCLUDE_PRAYER_LIST_KEY, String(next));
    } catch {
      // ignore
    }
  };

  const handlePrayerLettersToggle = () => {
    const next = !printIncludePrayerLetters;
    setPrintIncludePrayerLetters(next);
    // 기도편지를 체크하면 기도 제목도 함께 체크
    if (next && !printIncludePrayerList) {
      setPrintIncludePrayerList(true);
      try {
        localStorage.setItem(PRINT_INCLUDE_PRAYER_LIST_KEY, "true");
      } catch {
        // ignore
      }
    }
    try {
      localStorage.setItem(PRINT_INCLUDE_PRAYER_LETTERS_KEY, String(next));
    } catch {
      // ignore
    }
  };

  const handlePrint = () => {
    onPrint({
      includePrayerList: printIncludePrayerList,
      includePrayerLetters: printIncludePrayerLetters,
      fontSize: printFontSizePx,
    });
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handlePrayerListToggle}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            printIncludePrayerList
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          기도 제목
        </button>
        <button
          type="button"
          onClick={handlePrayerLettersToggle}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            printIncludePrayerLetters
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          기도편지
        </button>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-sm text-gray-600">폰트</span>
        <button
          type="button"
          onClick={() => changePrintFontSize(-1)}
          disabled={printFontSizePx <= MIN_PRINT_FONT_SIZE}
          className="w-7 h-7 rounded border border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs"
          aria-label="인쇄 글자 크기 줄이기"
        >
          −
        </button>
        <span className="min-w-[2rem] text-center text-sm text-gray-600">
          {printFontSizePx}
        </span>
        <button
          type="button"
          onClick={() => changePrintFontSize(1)}
          disabled={printFontSizePx >= MAX_PRINT_FONT_SIZE}
          className="w-7 h-7 rounded border border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs"
          aria-label="인쇄 글자 크기 키우기"
        >
          +
        </button>
      </div>
      <button
        type="button"
        onClick={handlePrint}
        className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors shadow-sm"
      >
        인쇄
      </button>
    </div>
  );
}
