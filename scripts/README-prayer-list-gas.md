# 기도 제목 목록 – Google Apps Script 연동

## ⚠️ "unknown action" 이 나올 때

- **원인**: GAS의 `doGet(e)` 안에 `action === 'prayerList'` 분기가 없거나, 수정 후 **배포가 반영되지 않은 경우**입니다.
- **해결**:
  1. 아래 **"doGet 전체 예시"**를 참고해 `prayerList` 분기를 **반드시** 추가합니다.
  2. **배포 관리** → 기존 웹 앱의 **버전**을 "새 버전"으로 올리거나 **배포 수정** 후 저장합니다. (코드만 저장하면 이전 배포 버전이 계속 실행됩니다.)
- **네트워크(localhost vs 192.168.x.x)**: 앱은 둘 다 동일하게 `/api/prayer-list`를 호출하고, 그 API가 GAS를 부릅니다. "unknown action"은 GAS가 보내는 응답이므로, **GAS 수정·배포만 하면** 같은 PC·다른 기기 모두에서 해결됩니다.

---

## 1. Drive 파일 규칙

- **파일명**: `선교사를_위한_기도문` 으로 **시작**하는 파일만 사용합니다.
- 예: `선교사를_위한_기도문(2026년)0115.txt`, `선교사를_위한_기도문(2026년)0215` 등
- **같은 Drive(또는 GAS가 접근 가능한 공유 폴더)** 에 여러 버전을 올려도, **수정일이 가장 최신인 파일 1개만** 파싱됩니다.
- 한글에서 **텍스트로 저장**할 때 **UTF-8** 인코딩으로 저장한 뒤 업로드하세요.

## 2. GAS에 넣는 방법

1. **스크립트 복사**  
   `scripts/prayer-list-gas.js` 안의 함수 전체를 복사합니다.

2. **기존 앱스크립트 프로젝트**를 연 뒤,  
   `missionaries`, `images` 처리하는 `doGet(e)` 이 있는 파일에  
   위에서 복사한 코드를 **같은 프로젝트 안**에 붙여 넣습니다.

3. **doGet(e) 에 분기 추가**  
   요청 파라미터 `action` 이 `prayerList` 일 때, Drive 최신 파일을 파싱해 JSON으로 돌려주도록 합니다.  
   **기존에 `else { return ... "unknown action" }` 이 있다면, 그 else 앞에 `else if (action === 'prayerList')` 를 넣어야 합니다.**

```javascript
function doGet(e) {
  var action = e.parameter.action;
  var result;

  if (action === 'prayerList') {
    result = getPrayerListFromDrive();
  } else if (action === 'missionaries') {
    // ... 기존 선교사 목록
  } else if (action === 'images') {
    // ... 기존 이미지 목록
  } else {
    result = { success: false, items: [], error: 'unknown action' };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
```

**기존 doGet이 아래처럼 되어 있는 경우**  
`if (action === 'missionaries') { ... } else if (action === 'images') { ... } else { return "unknown action"; }`  
→ **else if (action === 'prayerList') { result = getPrayerListFromDrive(); }** 를 **images 다음, else 앞**에 추가한 뒤, **else**에서는 `result`를 설정해 한 번만 `ContentService.createTextOutput(JSON.stringify(result))...` 로 반환하도록 합칩니다.

4. **배포**  
   기존 웹 앱 배포와 동일하게  
   - **실행 사용자**: 나  
   - **액세스**: 모든 사용자(또는 기존과 동일)  
   로 저장 후 **배포 URL**을 그대로 사용합니다.  
   Next 쪽에서는 `?action=prayerList` 만 붙여서 호출하면 됩니다.

## 3. 동작 요약

- Drive에서 `title contains '선교사를_위한_기도문'` 조건으로 파일을 검색합니다.
- 그중 **수정일(getLastUpdated)이 가장 늦은 파일 하나**만 고릅니다.
- 해당 파일 내용을 UTF-8로 읽어, 한글 문서 텍스트 포맷에 맞춰  
  `order`, `name`, `country`, `prayerContent`, `reference` 로 파싱합니다.
- 결과를 `{ success, items, fileName? }` 형태의 JSON으로 반환합니다.

이렇게 하면 파일명 뒤에 `(2026년)0115`, `(2026년)0215` 처럼 번호만 바꿔 올려도, 항상 **가장 최신 파일만** 반영됩니다.
