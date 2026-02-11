"use client";

type StatsDashboardProps = {
  totalMissionaries: number;
  totalCountries: number;
};

export default function StatsDashboard({
  totalMissionaries,
  totalCountries,
}: StatsDashboardProps) {
  return (
    <div className="grid grid-cols-2 gap-1.5 md:gap-2 mb-4">
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-2 md:p-3 border border-blue-200">
        <div className="text-[10px] md:text-xs text-blue-600 font-medium mb-0.5 md:mb-1">전체 선교사</div>
        <div className="text-lg md:text-2xl font-bold text-blue-700">{totalMissionaries}</div>
      </div>
      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-2 md:p-3 border border-purple-200">
        <div className="text-[10px] md:text-xs text-purple-600 font-medium mb-0.5 md:mb-1">활동 국가</div>
        <div className="text-lg md:text-2xl font-bold text-purple-700">{totalCountries}</div>
      </div>
    </div>
  );
}
