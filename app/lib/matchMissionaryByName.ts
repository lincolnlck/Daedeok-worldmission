/**
 * 기도 제목 항목과 선교사 목록을 '이름'으로 매칭합니다.
 * - 공백·쉼표 구분: '류봉선 이민정', '최인규, 박정희' → 각 부분으로 매칭 시도
 * - 선교사명이 붙어 있는 경우(양은순이선희, 윤희창이민근)도 기도 제목 '양은순 이선희', '윤희창 이민근'과 매칭
 * 매칭되지 않으면 null을 반환합니다.
 */

export type MissionaryForMatch = { name: string; folderId: string };

function normalizeName(s: string): string {
  return (s || "")
    .trim()
    .replace(/\s*선교사\s*$/, "")
    .trim();
}

/**
 * 한 부분(이름)이 선교사 이름과 일치하는지 확인
 * - 이상필 ↔ 이상필(이산지) (괄호 포함 폴더명)
 * - 양은순 ↔ 양은순이선희, 이선희 ↔ 양은순이선희 (붙어쓴 이름 앞/뒤 매칭)
 */
function namePartMatches(missionaryNormalized: string, partNormalized: string): boolean {
  if (!partNormalized) return false;
  if (missionaryNormalized === partNormalized) return true;
  // 폴더명이 "이상필(이산지)" 형태일 때 "이상필"로 매칭
  if (missionaryNormalized.startsWith(partNormalized + "(")) return true;
  // 폴더명이 "양은순이선희", "윤희창이민근"처럼 붙어 있을 때: 앞 또는 뒤 이름으로 매칭 (2글자 이상)
  if (partNormalized.length >= 2) {
    if (missionaryNormalized.startsWith(partNormalized)) return true;
    if (missionaryNormalized.endsWith(partNormalized)) return true;
  }
  return false;
}

/**
 * 선교사 목록에서 prayerName과 일치하는 첫 번째 선교사의 folderId를 반환합니다.
 * prayerName이 'A B' 또는 'A, B' 형태면, A 또는 B 중 한 명이라도 매칭되면 연결합니다.
 */
export function matchMissionaryByName(
  missionaries: MissionaryForMatch[],
  prayerName: string
): string | null {
  const normalized = normalizeName(prayerName);
  if (!normalized) return null;

  // 공백·쉼표로 구분 (예: '양은순 이선희', '최인규, 박정희')
  const parts = normalized.split(/\s*,\s*|\s+/).map((p) => p.trim()).filter(Boolean);

  for (const part of parts) {
    const m = missionaries.find((missionary) => {
      const mNorm = normalizeName(missionary.name);
      return namePartMatches(mNorm, part);
    });
    if (m) return m.folderId;
  }

  // 공백 없이 한 이름만 있는 경우: 전체 문자열로 한 번 더 시도
  const m = missionaries.find((missionary) =>
    namePartMatches(normalizeName(missionary.name), normalized)
  );
  return m ? m.folderId : null;
}
