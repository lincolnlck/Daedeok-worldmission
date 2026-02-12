"use client";

type StatsDashboardProps = {
  totalMissionaries: number;
  totalCountries: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
};

export default function StatsDashboard({
  totalMissionaries,
  totalCountries,
  onRefresh,
  isRefreshing = false,
}: StatsDashboardProps) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="grid grid-cols-2 gap-1.5 md:gap-2 flex-1 min-w-0">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-2 md:p-3 border border-blue-200">
          <div className="text-[10px] md:text-xs text-blue-600 font-medium mb-0.5 md:mb-1">전체 선교사</div>
          <div className="text-lg md:text-2xl font-bold text-blue-700">{totalMissionaries}</div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-2 md:p-3 border border-purple-200">
          <div className="text-[10px] md:text-xs text-purple-600 font-medium mb-0.5 md:mb-1">활동 국가</div>
          <div className="text-lg md:text-2xl font-bold text-purple-700">{totalCountries}</div>
        </div>
      </div>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex-shrink-0 w-9 h-9 md:w-10 md:h-10 rounded-lg bg-gray-100 hover:bg-gray-200 border border-gray-200 flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="새로고침"
          title="최신 목록 불러오기"
        >
          {isRefreshing ? (
            <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
