const ROOT_FOLDER_ID = "FOLDER_ID_PLACEHOLDER";

/***************************************
 * 선교사를 위한 기도문 (TXT) 자동 로딩 설정
 ***************************************/
const PRAYER_LIST_FILE_PREFIX = "선교사를_위한_기도문";

// (선택) 특정 폴더 안에서만 찾고 싶으면 폴더ID 입력
// 비워두면 Drive 전체에서 검색
const PRAYER_LIST_PARENT_FOLDER_ID = "";

// 캐시 시간 (초)
const PRAYER_LIST_CACHE_SECONDS = 60 * 5;

function doGet(e) {
  // 편집기에서 직접 실행 시 e가 undefined일 수 있으므로 방어
  const params = (e && e.parameter) ? e.parameter : {};

  const action = params.action || "missionaries";
  const sort = params.sort || ""; // missionaries용 ("updated" 가능)

  if (action === "prayerList") {
    return json_(getPrayerListFromDrive_());
  }

  if (action === "missionaries") {
    return json_(listMissionaryFolders_(sort));
  }

  if (action === "images") {
    const folderId = params.folderId;
    if (!folderId) return json_({ error: "folderId is required" });
    return json_(listImagesInFolder_(folderId));
  }

  return json_({ error: "unknown action" });
}

/**
 * 폴더명 파싱: "강부현(태국)" -> name="강부현", country="태국"
 * "이상필(이산지)(러시아)" -> name="이상필(이산지)", country="러시아" (마지막 괄호가 나라)
 */
function parseFolderName_(folderName) {
  const s = (folderName || "").trim();

  const m = s.match(/^(.*)\(([^()]+)\)\s*$/);
  if (m) {
    const namePart = (m[1] || "").trim();
    const country = (m[2] || "").trim();
    return { order: "", missionaryName: namePart || s, country: country, ministry: "" };
  }

  return { order: "", missionaryName: s, country: "", ministry: "" };
}

/**
 * 폴더 안 파일들 중 가장 최근 수정시간을 폴더 업데이트 시각으로 사용
 */
function getFolderUpdateInfo_(folder) {
  let latestDate = null;
  let latestFileName = "";

  const files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    const d = f.getLastUpdated();
    if (d && (!latestDate || d.getTime() > latestDate.getTime())) {
      latestDate = d;
      latestFileName = f.getName();
    }
  }

  // 폴더에 파일이 없을 때 폴더 자체 수정일 시도 (환경에 따라 미지원일 수 있음)
  if (!latestDate) {
    try {
      const d2 = folder.getLastUpdated && folder.getLastUpdated();
      if (d2) latestDate = d2;
    } catch (err) {}
  }

  const updatedAtMs = latestDate ? latestDate.getTime() : 0;
  const updatedAt = latestDate
    ? Utilities.formatDate(latestDate, "UTC", "yyyy-MM-dd'T'HH:mm:ss'Z'")
    : "";

  return { updatedAtMs: updatedAtMs, updatedAt: updatedAt, latestFileName: latestFileName };
}

function listMissionaryFolders_(sort) {
  const cache = CacheService.getScriptCache();
  const cacheKey = "missionary_folders_v6_" + (sort || "name");
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const root = DriveApp.getFolderById(ROOT_FOLDER_ID);
  const it = root.getFolders();

  const items = [];
  while (it.hasNext()) {
    const folder = it.next();
    const folderName = (folder.getName() || "").trim();

    if (!folderName) continue;
    if (folderName.toLowerCase() === "desktop") continue;

    const parsed = parseFolderName_(folderName);
    const upd = getFolderUpdateInfo_(folder);

    items.push({
      folderId: folder.getId(),
      folderName: folderName,
      order: parsed.order,
      name: parsed.missionaryName,
      country: parsed.country,
      ministry: parsed.ministry,

      updatedAtMs: upd.updatedAtMs,
      updatedAt: upd.updatedAt,
      latestFileName: upd.latestFileName
    });
  }

  if (sort === "updated") {
    items.sort(function (a, b) {
      const diff = (b.updatedAtMs || 0) - (a.updatedAtMs || 0);
      if (diff !== 0) return diff;
      return a.folderName.localeCompare(b.folderName, "ko");
    });
  } else {
    items.sort(function (a, b) {
      return a.folderName.localeCompare(b.folderName, "ko");
    });
  }

  const result = { items: items };
  cache.put(cacheKey, JSON.stringify(result), 60 * 10); // 10분 캐시
  return result;
}

function listImagesInFolder_(folderId) {
  const cache = CacheService.getScriptCache();
  const cacheKey = "folder_images_v7_" + folderId;

  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const folder = DriveApp.getFolderById(folderId);
  const it = folder.getFiles();

  const images = [];
  while (it.hasNext()) {
    const file = it.next();
    const mt = file.getMimeType();
    if (mt && mt.indexOf("image/") === 0) {
      const id = file.getId();
      const created = file.getDateCreated();
      const updated = file.getLastUpdated();

      images.push({
        fileId: id,
        name: file.getName(),
        mimeType: mt,
        url: "https://drive.google.com/thumbnail?id=" + id + "&sz=w2000",
        createdAtMs: created ? created.getTime() : 0,
        createdAt: created ? Utilities.formatDate(created, "UTC", "yyyy-MM-dd'T'HH:mm:ss'Z'") : "",
        updatedAtMs: updated ? updated.getTime() : 0,
        updatedAt: updated ? Utilities.formatDate(updated, "UTC", "yyyy-MM-dd'T'HH:mm:ss'Z'") : ""
      });
    }
  }

  // 최신순
  images.sort(function (a, b) {
    return (b.createdAtMs || 0) - (a.createdAtMs || 0);
  });

  const result = { folderId: folderId, images: images };
  cache.put(cacheKey, JSON.stringify(result), 60 * 5);
  return result;
}

/***************************************
 * 선교사를 위한 기도문 (TXT) 자동 로딩
 ***************************************/
function getPrayerListFromDrive_() {
  const cache = CacheService.getScriptCache();
  const cacheKey = "prayer_list_v2";
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const latest = findLatestPrayerListFile_();
  if (!latest) {
    const resultNotFound = {
      success: false,
      items: [],
      commonPrayerItems: [],
      message: "선교사를_위한_기도문으로 시작하는 파일을 찾지 못했습니다."
    };
    cache.put(cacheKey, JSON.stringify(resultNotFound), 60);
    return resultNotFound;
  }

  const file = latest.file;
  const blob = file.getBlob();

  let text = "";
  try {
    text = blob.getDataAsString("UTF-8");
  } catch (err) {
    text = blob.getDataAsString();
  }

  const parsedAll = parsePrayerListDocument_(text);

  const result = {
    success: true,
    fileName: file.getName(),
    fileId: file.getId(),
    updatedAt: Utilities.formatDate(file.getLastUpdated(), "UTC", "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    itemCount: parsedAll.items.length,
    commonPrayerItems: parsedAll.commonPrayerItems,
    items: parsedAll.items
  };

  cache.put(cacheKey, JSON.stringify(result), PRAYER_LIST_CACHE_SECONDS);
  return result;
}

function findLatestPrayerListFile_() {
  let query = "title contains '" + escapeQuery_(PRAYER_LIST_FILE_PREFIX) + "' and trashed = false";

  if (PRAYER_LIST_PARENT_FOLDER_ID) {
    query += " and '" + PRAYER_LIST_PARENT_FOLDER_ID + "' in parents";
  }

  const it = DriveApp.searchFiles(query);

  let best = null;
  while (it.hasNext()) {
    const f = it.next();
    const name = f.getName() || "";

    // "시작하는 파일만" 사용
    if (name.indexOf(PRAYER_LIST_FILE_PREFIX) !== 0) continue;

    const updated = f.getLastUpdated();
    const updatedMs = updated ? updated.getTime() : 0;

    if (!best || updatedMs > best.updatedMs) {
      best = { file: f, updatedMs: updatedMs };
    }
  }

  return best;
}

function escapeQuery_(s) {
  return String(s || "").replace(/'/g, "\\'");
}

/**
 * 문서 전체 파싱:
 * - 상단 공동기도 추출
 * - [국가명 순서] 이후 본문만 추출
 * - 번호(1,2,3...) 기준으로 항목 분리
 * - 각 항목을 name/country/prayerContent/reference(날짜)로 정리
 */
function parsePrayerListDocument_(raw) {
  if (!raw) return { commonPrayerItems: [], items: [] };

  let text = String(raw)
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const commonPrayerItems = extractCommonPrayerItems_(text);
  const mainSection = extractMainMissionarySection_(text);
  const blocks = splitTopLevelMissionaryBlocks_(mainSection);

  const items = [];
  for (let i = 0; i < blocks.length; i++) {
    const item = parseMissionaryPrayerBlock_(blocks[i]);
    if (item) items.push(item);
  }

  return {
    commonPrayerItems: commonPrayerItems,
    items: items
  };
}

/**
 * 호환용: 기존 코드가 parsePrayerListText_를 호출해도 동작
 */
function parsePrayerListText_(raw) {
  return parsePrayerListDocument_(raw).items;
}

/**
 * 상단 "공동 기도 내용" 영역 bullet 추출
 */
function extractCommonPrayerItems_(text) {
  const lines = text.split("\n");
  const items = [];

  let inCommon = false;
  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] || "").trim();

    if (!inCommon && line.indexOf("공동 기도 내용") >= 0) {
      inCommon = true;
      continue;
    }

    if (inCommon) {
      if (line.indexOf("[국가명 순서]") >= 0 || line.indexOf("협력선교사 최신 기도편지") >= 0) {
        break;
      }

      if (/^[▶▪\-•]\s*/.test(line)) {
        items.push(line.replace(/^[▶▪\-•]\s*/, "").trim());
      }
    }
  }

  return items;
}

/**
 * 본문 시작([국가명 순서]) 이후만 사용
 */
function extractMainMissionarySection_(text) {
  const idx = text.indexOf("[국가명 순서]");
  if (idx >= 0) return text.substring(idx);
  return text;
}

/**
 * 최상위 번호(1,2,3...) 기준으로 선교사 블록 분리
 */
function splitTopLevelMissionaryBlocks_(text) {
  const lines = text.split("\n");

  const blocks = [];
  let current = [];
  let started = false;

  for (let i = 0; i < lines.length; i++) {
    const lineRaw = lines[i];
    const line = (lineRaw || "").trim();

    // 헤더 제거
    if (
      line === "[국가명 순서]" ||
      line === "순서" ||
      line === "성명(국가)" ||
      line === "기도제목" ||
      line === "참고"
    ) {
      continue;
    }

    // 새 항목 시작: 줄 전체가 숫자
    if (/^\d{1,2}$/.test(line)) {
      if (started && current.length > 0) {
        blocks.push(current.join("\n").trim());
        current = [];
      }
      started = true;
      current.push(line);
      continue;
    }

    if (!started) continue;

    current.push(lineRaw);
  }

  if (current.length > 0) {
    blocks.push(current.join("\n").trim());
  }

  return blocks.filter(function (b) { return !!b; });
}

/**
 * 선교사 블록 1개 파싱
 */
function parseMissionaryPrayerBlock_(blockText) {
  const lines = blockText
    .split("\n")
    .map(function (s) { return (s || "").trim(); })
    .filter(function (s) { return s !== ""; });

  if (lines.length === 0) return null;

  // 첫 줄: 순서
  const order = lines[0];
  if (!/^\d{1,2}$/.test(order)) return null;

  const rest = lines.slice(1);

  // 블록 끝쪽 날짜 추출
  const tail = extractTailDateAndTrim_(rest);
  const dateStr = tail.dateStr;
  const bodyLines = tail.bodyLines;

  // 상단 이름/국가 추출
  const topInfo = extractTopNameCountry_(bodyLines);

  // 나머지는 기도내용
  const prayerLines = bodyLines.slice(topInfo.consumedCount);
  const prayerContent = prayerLines.join("\n").trim();

  const item = {
    order: String(order),
    name: topInfo.name || "",
    country: topInfo.country || "",
    prayerContent: prayerContent,
    reference: dateStr || "" // 이 파일에서는 참고 칸이 사실상 날짜
  };

  if (!item.name && !item.country && !item.prayerContent) return null;

  return item;
}

/**
 * 블록 상단 name/country 추출
 * - 이름 여러 줄 가능 (공백으로 합침)
 * - "(네팔)" 같은 단독 괄호 줄은 country
 * - 기도내용 시작 패턴이 나오면 중단
 */
function extractTopNameCountry_(lines) {
  const nameParts = [];
  let country = "";
  let i = 0;

  for (; i < lines.length; i++) {
    const line = (lines[i] || "").trim();
    if (!line) continue;

    if (looksLikePrayerContentStart_(line)) break;
    if (looksLikeDateFragment_(line)) break;

    // 단독 괄호 줄 -> 국가
    let m = line.match(/^\(([^()]+)\)$/);
    if (m) {
      if (!country) country = m[1].trim();
      continue;
    }

    nameParts.push(line);
  }

  const name = nameParts.join(" ").replace(/\s{2,}/g, " ").trim();

  return {
    name: name,
    country: country,
    consumedCount: i
  };
}

/**
 * 기도내용 시작으로 볼 패턴
 */
function looksLikePrayerContentStart_(line) {
  if (!line) return false;

  if (/^\d+\s*[.)]\s*/.test(line)) return true; // 1. / 1)
  if (/^[\-▪•]\s*/.test(line)) return true;     // bullet
  if (/^🛐/.test(line)) return true;
  if (/^\[.*\]$/.test(line)) return true;       // [ ... ]
  if (/^(지도|부장)\s*:/.test(line)) return true;

  return false;
}

/**
 * 블록 끝 날짜(참고) 추출
 * 예: "2025." + "12.13" -> "2025.12.13"
 */
function extractTailDateAndTrim_(lines) {
  if (!lines || lines.length === 0) {
    return { dateStr: "", bodyLines: [] };
  }

  let end = lines.length - 1;
  const dateParts = [];

  while (end >= 0) {
    const line = (lines[end] || "").trim();

    if (!line) {
      end--;
      continue;
    }

    if (looksLikeDateFragment_(line)) {
      dateParts.unshift(line);
      end--;
      continue;
    }

    break;
  }

  let dateStr = dateParts.join(" ").trim();
  dateStr = normalizeDateString_(dateStr);

  if (dateStr && !/\d/.test(dateStr)) {
    dateStr = "";
  }

  return {
    dateStr: dateStr,
    bodyLines: lines.slice(0, end + 1)
  };
}

/**
 * 날짜 조각 판별
 */
function looksLikeDateFragment_(line) {
  if (!line) return false;

  // 2025. / 12.13 / 12.31. / 25.3 / 2025.12
  if (/^\d{2,4}\.$/.test(line)) return true;
  if (/^\d{1,2}\.\d{1,2}\.?$/.test(line)) return true;
  if (/^\d{2,4}\.\d{1,2}\.?$/.test(line)) return true;

  return false;
}

/**
 * 날짜 문자열 정리
 * "2025. 12.13" -> "2025.12.13"
 * "2025. 12.31." -> "2025.12.31"
 */
function normalizeDateString_(s) {
  let t = (s || "").trim();
  if (!t) return "";

  t = t.replace(/\s+/g, "");
  t = t.replace(/\.$/, "");

  return t;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
