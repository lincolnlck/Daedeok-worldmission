"use client";

import Link from "next/link";

export default function Header() {
  return (
    <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg">
      <div className="container mx-auto px-3 md:px-4 py-4 md:py-6">
        <h1 className="text-xl md:text-3xl font-bold mb-1 md:mb-2">🌍 대덕교회 협력선교사 기도편지</h1>
        <p className="text-blue-100 text-xs md:text-sm lg:text-base leading-relaxed">
          전 세계 선교사님들의 기도편지를 지도에서 확인하고 함께 기도해주세요
        </p>
        <div className="flex flex-wrap gap-2 mt-3 md:mt-4">
          <Link
            href="/favorites"
            className="inline-flex items-center gap-2 px-4 py-2.5 md:px-5 md:py-3 rounded-lg bg-white/15 hover:bg-white/25 text-white font-semibold text-sm md:text-base shadow-md border border-white/20 transition-colors"
          >
            ⭐ 즐겨찾기
          </Link>
          <Link
            href="/prayer-list"
            className="inline-flex items-center gap-2 px-4 py-2.5 md:px-5 md:py-3 rounded-lg bg-white/15 hover:bg-white/25 text-white font-semibold text-sm md:text-base shadow-md border border-white/20 transition-colors"
          >
            📋 선교사를 위한 기도 제목
          </Link>
        </div>
      </div>
    </header>
  );
}
