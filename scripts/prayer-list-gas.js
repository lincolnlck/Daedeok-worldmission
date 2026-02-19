/**
 * Google Apps Script: 기도 제목 목록 (Drive 텍스트 파일)
 *
 * - 파일명이 "선교사를_위한_기도문"으로 시작하는 파일 중
 *   수정일 기준 가장 최신 파일 1개만 읽어서 파싱 후 JSON 반환
 *
 * 사용법: 기존 GAS doGet(e) 안에서 action === 'prayerList' 일 때
 *        getPrayerListFromDrive() 결과를 반환하도록 호출하면 됩니다.
 */

var PRAYER_FILE_NAME_PREFIX = '선교사를_위한_기도문';

/**
 * Drive에서 접두어에 해당하는 파일 중 가장 최신 파일 찾기
 * @returns {GoogleAppsScript.Drive.File | null}
 */
function findNewestPrayerFile() {
  var query = "title contains '" + PRAYER_FILE_NAME_PREFIX + "'";
  var iterator = DriveApp.searchFiles(query);
  var newestFile = null;
  var newestDate = null;

  while (iterator.hasNext()) {
    var file = iterator.next();
    var updated = file.getLastUpdated();
    if (!newestDate || updated.getTime() > newestDate.getTime()) {
      newestDate = updated;
      newestFile = file;
    }
  }

  return newestFile;
}

/**
 * Drive 최신 파일 내용 읽기 (UTF-8)
 * @returns {string}
 */
function readPrayerFileContent(file) {
  var blob = file.getBlob();
  return blob.getDataAsString('UTF-8');
}

/**
 * 텍스트 본문을 블록 단위로 파싱 (한글 문서 텍스트 저장 포맷 기준)
 * @param {string} content
 * @returns {Array<{order: number, name: string, country: string, prayerContent: string, reference: string}>}
 */
function parsePrayerText(content) {
  var lines = content.split(/\r?\n/);
  var items = [];
  var i = 0;

  // "[국가명 순서]" 이후 "참고" 헤더 다음부터 데이터
  while (i < lines.length) {
    if (lines[i].trim() === '참고') {
      i++;
      break;
    }
    i++;
  }

  while (i < lines.length) {
    var line = lines[i];
    var trimmed = line.trim();

    // 블록 시작: 숫자만 있는 줄
    if (/^\d+$/.test(trimmed)) {
      var order = parseInt(trimmed, 10);
      var nameParts = [];
      var country = '';
      i++;

      // 성명(국가) 줄들: (국가) 또는 일반 이름 줄
      while (i < lines.length) {
        var l = lines[i];
        var lt = l.trim();
        if (/^\d+\.\s/.test(lt)) break; // 기도제목 시작 "1. ..."
        if (/^\([^)]+\)$/.test(lt)) {
          country = lt.replace(/^\(|\)$/g, '');
          i++;
          break;
        }
        if (lt.length > 0) nameParts.push(lt);
        i++;
      }

      var name = nameParts.join(' ').trim();

      // 기도제목: 다음 블록(숫자만) 또는 날짜 패턴 전까지
      var prayerLines = [];
      var reference = '';

      while (i < lines.length) {
        var l = lines[i];
        var lt = l.trim();

        // 참고(날짜): "2025." 다음 "12.13" 또는 "2025. 12.30"
        if (/^\d{4}\.$/.test(lt)) {
          reference = lt;
          i++;
          if (i < lines.length && /^\d{1,2}\.\s*\d{1,2}/.test(lines[i].trim())) {
            reference += ' ' + lines[i].trim();
            i++;
          }
          break;
        }
        if (/^\d{1,2}\.\d{1,2}/.test(lt) && reference === '' && prayerLines.length > 0) {
          reference = lt;
          i++;
          break;
        }
        if (/^\d+$/.test(lt)) break; // 다음 블록

        prayerLines.push(l);
        i++;
      }

      var prayerContent = prayerLines.join('\n').trim();
      items.push({
        order: order,
        name: name,
        country: country,
        prayerContent: prayerContent,
        reference: reference
      });
    } else {
      i++;
    }
  }

  return items;
}

/**
 * 기도 제목 목록 조회 (Drive 최신 파일 파싱)
 * @returns {Object} { success: boolean, items: Array, fileName?: string, error?: string }
 */
function getPrayerListFromDrive() {
  try {
    var file = findNewestPrayerFile();
    if (!file) {
      return {
        success: false,
        items: [],
        error: '선교사를_위한_기도문 으로 시작하는 파일을 Drive에서 찾을 수 없습니다.'
      };
    }

    var content = readPrayerFileContent(file);
    var items = parsePrayerText(content);

    return {
      success: true,
      items: items,
      fileName: file.getName()
    };
  } catch (e) {
    return {
      success: false,
      items: [],
      error: e.toString()
    };
  }
}

/**
 * doGet에서 사용 예시 (기존 스크립트에 아래 분기만 추가)
 *
 * function doGet(e) {
 *   var action = e.parameter.action;
 *   var result;
 *
 *   if (action === 'prayerList') {
 *     result = getPrayerListFromDrive();
 *   } else if (action === 'missionaries') {
 *     // ... 기존
 *   } else if (action === 'images') {
 *     // ... 기존
 *   }
 *
 *   return ContentService.createTextOutput(JSON.stringify(result))
 *     .setMimeType(ContentService.MimeType.JSON);
 * }
 */
