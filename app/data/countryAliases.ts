/**
 * countryAliases.ts
 * - 입력된 나라/지역 표기를 정규화하고
 * - 흔한 별칭/약칭/영문/ISO 코드 등을 "후보 리스트"로 제공한 다음
 * - 실제 countryCenters(자동생성)의 키 중 존재하는 값을 자동 선택합니다.
 */

export const customRegionCenters: Record<string, { lat: number; lng: number }> = {
  // 국가가 아닌 "지역/보안표기"가 들어올 때 지도에 찍을 임시 좌표
  "히말라야": { lat: 27.9878, lng: 86.9250 }, // 에베레스트 부근(네팔)
  "중동": { lat: 31.0, lng: 35.0 },
  "북아프리카": { lat: 30.0, lng: 10.0 },
  "서아프리카": { lat: 9.0, lng: -1.0 },
  "동아프리카": { lat: 1.0, lng: 36.0 },
  "중앙아시아": { lat: 41.0, lng: 64.0 },
  "동남아": { lat: 14.0, lng: 101.0 },
  "남미": { lat: -15.0, lng: -60.0 },
  "중미": { lat: 13.0, lng: -85.0 },
  "유럽": { lat: 50.0, lng: 10.0 },
  "오세아니아": { lat: -25.0, lng: 134.0 },
  "C국": { lat: 35.0, lng: 103.0 }, // 보안표기 임시(중국 중앙부)
  "H국": { lat: 23.7, lng: 90.4 },   // 예: 방글라데시 쪽 임시
};

export function normalizeCountryLabel(input: string): string {
  if (!input) return "";
  return input
    .trim()
    // 괄호 내용 제거: "중국(NK)" -> "중국"
    .replace(/\([^)]*\)/g, "")
    // 특수문자/구분자 제거
    .replace(/[·•・]/g, " ")
    .replace(/[-_/]/g, " ")
    // 불필요 단어 제거(아주 흔한 패턴만)
    .replace(/\b(공화국|연방|왕국|국|자치령|특별행정구|특별행정지역)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 별칭 후보 사전
 * - 값은 "가능한 정식 표기 후보들"의 배열입니다.
 * - resolveCountryKey()가 countryCenters에 실제 존재하는 후보를 골라줍니다.
 */
export const aliasCandidates: Record<string, string[]> = {
  // ===== 한국/북한/중국권 =====
  "한국": ["대한민국", "한국", "남한", "South Korea", "Korea, Republic of", "Republic of Korea", "ROK", "KOR"],
  "대한민국": ["대한민국", "한국", "남한", "South Korea", "Republic of Korea", "ROK", "KOR"],
  "남한": ["대한민국", "한국", "South Korea", "Republic of Korea", "ROK", "KOR"],
  "북한": ["조선민주주의인민공화국", "북한", "조선", "North Korea", "DPRK", "PRK", "KP"],
  "조선": ["조선민주주의인민공화국", "북한", "North Korea", "DPRK"],
  "중국": ["중국", "중화인민공화국", "China", "PRC", "CN", "CHN"],
  "중화인민공화국": ["중국", "중화인민공화국", "China", "PRC", "CHN"],
  "C국": ["중국", "중화인민공화국", "China", "PRC", "CHN", "C국"],
  "홍콩": ["홍콩", "Hong Kong", "홍콩 특별행정구", "HKG"],
  "마카오": ["마카오", "Macao", "마카오 특별행정구", "MAC"],
  "대만": ["대만", "타이완", "Taiwan", "중화민국", "ROC", "TWN"],
  "타이완": ["대만", "타이완", "Taiwan", "TWN"],

  // ===== 동남아/남아시아 =====
  "태국": ["태국", "Thailand", "타이", "TH", "THA"],
  "타이": ["태국", "Thailand", "THA"],
  "베트남": ["베트남", "Viet Nam", "Vietnam", "VN", "VNM"],
  "라오스": ["라오스", "라오 인민민주주의 공화국", "Laos", "Lao PDR", "LA", "LAO"],
  "캄보디아": ["캄보디아", "Cambodia", "캄푸치아", "KH", "KHM"],
  "미얀마": ["미얀마", "Myanmar", "버마", "Burma", "MM", "MMR"],
  "버마": ["미얀마", "Myanmar", "Burma", "MMR"],
  "말레이시아": ["말레이시아", "Malaysia", "MY", "MYS"],
  "싱가포르": ["싱가포르", "Singapore", "SG", "SGP"],
  "인도네시아": ["인도네시아", "Indonesia", "ID", "IDN"],
  "필리핀": ["필리핀", "Philippines", "PH", "PHL"],
  "브루나이": ["브루나이", "브루나이 다루살람", "Brunei", "BN", "BRN"],
  "동티모르": ["동티모르", "티모르레슈티", "티모르-레슈테", "Timor-Leste", "TL", "TLS"],
  "티모르레슈티": ["동티모르", "Timor-Leste", "TLS"],
  "인도": ["인도", "India", "IN", "IND"],
  "네팔": ["네팔", "Nepal", "NP", "NPL"],
  "스리랑카": ["스리랑카", "Sri Lanka", "LK", "LKA"],
  "파키스탄": ["파키스탄", "Pakistan", "PK", "PAK"],
  "방글라데시": ["방글라데시", "Bangladesh", "BD", "BGD"],
  "부탄": ["부탄", "Bhutan", "BT", "BTN"],
  "몰디브": ["몰디브", "Maldives", "MV", "MDV"],
  "아프가니스탄": ["아프가니스탄", "Afghanistan", "AF", "AFG"],

  // ===== 중동/중앙아시아 =====
  "요르단": ["요르단", "Jordan", "JO", "JOR"],
  "사우디": ["사우디아라비아", "사우디", "Saudi Arabia", "KSA", "SA", "SAU"],
  "사우디아라비아": ["사우디아라비아", "Saudi Arabia", "KSA", "SAU"],
  "UAE": ["아랍에미리트", "아랍에미리트연합", "United Arab Emirates", "UAE", "AE", "ARE"],
  "아랍에미리트": ["아랍에미리트", "아랍에미리트연합", "United Arab Emirates", "UAE", "ARE"],
  "카타르": ["카타르", "Qatar", "QA", "QAT"],
  "쿠웨이트": ["쿠웨이트", "Kuwait", "KW", "KWT"],
  "오만": ["오만", "Oman", "OM", "OMN"],
  "바레인": ["바레인", "Bahrain", "BH", "BHR"],
  "예멘": ["예멘", "Yemen", "YE", "YEM"],
  "이란": ["이란", "이란 이슬람 공화국", "Iran", "IR", "IRN"],
  "이라크": ["이라크", "Iraq", "IQ", "IRQ"],
  "시리아": ["시리아", "Syria", "SY", "SYR"],
  "레바논": ["레바논", "Lebanon", "LB", "LBN"],
  "이스라엘": ["이스라엘", "Israel", "IL", "ISR"],
  "팔레스타인": ["팔레스타인", "팔레스타인 국가", "State of Palestine", "PS", "PSE"],
  "터키": ["튀르키예", "터키", "Türkiye", "Turkey", "TR", "TUR"],
  "튀르키예": ["튀르키예", "터키", "Türkiye", "Turkey", "TUR"],
  "조지아": ["조지아", "Georgia", "GE", "GEO"],
  "아르메니아": ["아르메니아", "Armenia", "AM", "ARM"],
  "아제르바이잔": ["아제르바이잔", "Azerbaijan", "AZ", "AZE"],
  "카자흐스탄": ["카자흐스탄", "Kazakhstan", "KZ", "KAZ"],
  "우즈베키스탄": ["우즈베키스탄", "Uzbekistan", "UZ", "UZB"],
  "키르기스스탄": ["키르기스스탄", "Kyrgyzstan", "KG", "KGZ"],
  "타지키스탄": ["타지키스탄", "Tajikistan", "TJ", "TJK"],
  "투르크메니스탄": ["투르크메니스탄", "Turkmenistan", "TM", "TKM"],

  // ===== 유럽 =====
  "러시아": ["러시아", "러시아 연방", "Russian Federation", "Russia", "RU", "RUS"],
  "우크라이나": ["우크라이나", "Ukraine", "UA", "UKR"],
  "벨라루스": ["벨라루스", "Belarus", "BY", "BLR"],
  "영국": ["영국", "United Kingdom", "UK", "U.K.", "GB", "GBR", "그레이트브리튼"],
  "프랑스": ["프랑스", "France", "FR", "FRA"],
  "독일": ["독일", "Germany", "DE", "DEU"],
  "이탈리아": ["이탈리아", "Italy", "IT", "ITA"],
  "스페인": ["스페인", "Spain", "ES", "ESP"],
  "포르투갈": ["포르투갈", "Portugal", "PT", "PRT"],
  "네덜란드": ["네덜란드", "홀란드", "Netherlands", "NL", "NLD"],
  "벨기에": ["벨기에", "Belgium", "BE", "BEL"],
  "스위스": ["스위스", "Switzerland", "CH", "CHE"],
  "오스트리아": ["오스트리아", "Austria", "AT", "AUT"],
  "스웨덴": ["스웨덴", "Sweden", "SE", "SWE"],
  "노르웨이": ["노르웨이", "Norway", "NO", "NOR"],
  "덴마크": ["덴마크", "Denmark", "DK", "DNK"],
  "핀란드": ["핀란드", "Finland", "FI", "FIN"],
  "아이슬란드": ["아이슬란드", "Iceland", "IS", "ISL"],
  "폴란드": ["폴란드", "Poland", "PL", "POL"],
  "체코": ["체코", "체코 공화국", "Czechia", "Czech Republic", "CZ", "CZE"],
  "헝가리": ["헝가리", "Hungary", "HU", "HUN"],
  "루마니아": ["루마니아", "Romania", "RO", "ROU"],
  "불가리아": ["불가리아", "Bulgaria", "BG", "BGR"],
  "그리스": ["그리스", "Greece", "EL", "GR", "GRC"],
  "크로아티아": ["크로아티아", "Croatia", "HR", "HRV"],
  "세르비아": ["세르비아", "Serbia", "RS", "SRB"],
  "보스니아": ["보스니아 헤르체고비나", "보스니아", "Bosnia and Herzegovina", "BA", "BIH"],
  "알바니아": ["알바니아", "Albania", "AL", "ALB"],
  "북마케도니아": ["북마케도니아", "마케도니아", "North Macedonia", "MK", "MKD"],
  "슬로베니아": ["슬로베니아", "Slovenia", "SI", "SVN"],
  "슬로바키아": ["슬로바키아", "Slovakia", "SK", "SVK"],
  "아일랜드": ["아일랜드", "Ireland", "IE", "IRL"],
  "룩셈부르크": ["룩셈부르크", "Luxembourg", "LU", "LUX"],
  "몰타": ["몰타", "Malta", "MT", "MLT"],
  "키프로스": ["키프로스", "Cyprus", "CY", "CYP"],
  "리투아니아": ["리투아니아", "Lithuania", "LT", "LTU"],
  "라트비아": ["라트비아", "Latvia", "LV", "LVA"],
  "에스토니아": ["에스토니아", "Estonia", "EE", "EST"],

  // ===== 아메리카 =====
  "미국": ["미국", "미합중국", "United States", "United States of America", "USA", "US", "U.S.", "U.S.A", "UMI", "USA"],
  "미합중국": ["미국", "미합중국", "United States", "USA", "US"],
  "캐나다": ["캐나다", "Canada", "CA", "CAN"],
  "멕시코": ["멕시코", "Mexico", "MX", "MEX"],
  "브라질": ["브라질", "Brazil", "BR", "BRA"],
  "아르헨티나": ["아르헨티나", "Argentina", "AR", "ARG"],
  "칠레": ["칠레", "Chile", "CL", "CHL"],
  "페루": ["페루", "Peru", "PE", "PER"],
  "콜롬비아": ["콜롬비아", "Colombia", "CO", "COL"],
  "베네수엘라": ["베네수엘라", "Venezuela", "VE", "VEN"],
  "볼리비아": ["볼리비아", "Bolivia", "BO", "BOL"],
  "에콰도르": ["에콰도르", "Ecuador", "EC", "ECU"],
  "파라과이": ["파라과이", "Paraguay", "PY", "PRY"],
  "우루과이": ["우루과이", "Uruguay", "UY", "URY"],
  "파나마": ["파나마", "Panama", "PA", "PAN"],
  "코스타리카": ["코스타리카", "Costa Rica", "CR", "CRI"],
  "과테말라": ["과테말라", "Guatemala", "GT", "GTM"],
  "온두라스": ["온두라스", "Honduras", "HN", "HND"],
  "니카라과": ["니카라과", "Nicaragua", "NI", "NIC"],
  "엘살바도르": ["엘살바도르", "El Salvador", "SV", "SLV"],
  "도미니카공화국": ["도미니카 공화국", "도미니카공화국", "Dominican Republic", "DO", "DOM"],
  // ⚠️ "도미니카"는 Dominica(국가)일 수도 있어 애매합니다. 필요하면 아래를 사용하세요.
  "도미니카": ["도미니카 공화국", "도미니카", "Dominican Republic", "Dominica"],

  // ===== 아프리카 =====
  "남아공": ["남아프리카 공화국", "남아공", "South Africa", "ZA", "ZAF"],
  "남아프리카": ["남아프리카 공화국", "남아공", "South Africa", "ZAF"],
  "케냐": ["케냐", "Kenya", "KE", "KEN"],
  "우간다": ["우간다", "Uganda", "UG", "UGA"],
  "탄자니아": ["탄자니아", "Tanzania", "United Republic of Tanzania", "TZ", "TZA"],
  "르완다": ["르완다", "Rwanda", "RW", "RWA"],
  "부룬디": ["부룬디", "Burundi", "BI", "BDI"],
  "에티오피아": ["에티오피아", "Ethiopia", "ET", "ETH"],
  "수단": ["수단", "Sudan", "SD", "SDN"],
  "남수단": ["남수단", "South Sudan", "SS", "SSD"],
  "나이지리아": ["나이지리아", "Nigeria", "NG", "NGA"],
  "가나": ["가나", "Ghana", "GH", "GHA"],
  "카메룬": ["카메룬", "Cameroon", "CM", "CMR"],
  "세네갈": ["세네갈", "Senegal", "SN", "SEN"],
  "코트디부아르": ["코트디부아르", "코트디부아르 공화국", "아이보리코스트", "Côte d'Ivoire", "CI", "CIV"],
  "아이보리코스트": ["코트디부아르", "Côte d'Ivoire", "CIV"],
  "콩고민주공화국": ["콩고 민주 공화국", "콩고민주공화국", "DR콩고", "콩고(킨샤사)", "Congo, Democratic Republic of the", "CD", "COD"],
  "DR콩고": ["콩고 민주 공화국", "Congo, Democratic Republic of the", "COD"],
  "콩고공화국": ["콩고 공화국", "콩고공화국", "콩고(브라자빌)", "Republic of the Congo", "CG", "COG"],
  "모리셔스": ["모리셔스", "Mauritius", "MU", "MUS"],
  "모로코": ["모로코", "Morocco", "MA", "MAR"],
  "튀니지": ["튀니지", "Tunisia", "TN", "TUN"],
  "알제리": ["알제리", "Algeria", "DZ", "DZA"],
  "이집트": ["이집트", "Egypt", "EG", "EGY"],
  "리비아": ["리비아", "Libya", "LY", "LBY"],
  "마다가스카르": ["마다가스카르", "Madagascar", "MG", "MDG"],
  "모잠비크": ["모잠비크", "Mozambique", "MZ", "MOZ"],
  "짐바브웨": ["짐바브웨", "Zimbabwe", "ZW", "ZWE"],
  "잠비아": ["잠비아", "Zambia", "ZM", "ZMB"],
  "나미비아": ["나미비아", "Namibia", "NA", "NAM"],
  "보츠와나": ["보츠와나", "Botswana", "BW", "BWA"],
  "앙골라": ["앙골라", "Angola", "AO", "AGO"],
  "피지": ["피지", "Fiji", "FJ", "FJI"],

  // ===== 오세아니아 =====
  "호주": ["호주", "오스트레일리아", "Australia", "AU", "AUS"],
  "오스트레일리아": ["호주", "오스트레일리아", "Australia", "AUS"],
  "뉴질랜드": ["뉴질랜드", "New Zealand", "NZ", "NZL"],
};

/**
 * 실제 countryCenters(자동생성) 키에 맞춰 최종 키를 결정
 * - centers에 이미 있으면 그대로
 * - 정규화한 키가 있으면 사용
 * - 별칭 후보 리스트 중 "centers에 존재하는 첫 후보"를 사용
 * - 마지막으로 customRegionCenters에 있으면 그 키를 사용
 * - 그래도 없으면 원본(또는 정규화)을 반환 (fallback)
 */
export function resolveCountryKey(
  raw: string,
  centers: Record<string, { lat: number; lng: number }>
): string {
  const original = (raw || "").trim();
  if (!original) return "";

  // 1) 원본이 이미 키로 존재
  if (centers[original]) return original;

  // 2) 정규화
  const n = normalizeCountryLabel(original);
  if (n && centers[n]) return n;

  // 3) 별칭 후보 탐색(원본/정규화 둘 다)
  const candLists: string[][] = [];
  if (aliasCandidates[original]) candLists.push(aliasCandidates[original]);
  if (n && aliasCandidates[n]) candLists.push(aliasCandidates[n]);

  // "대문자 코드(USA/UK/UAE…)" 같은 경우를 위해 원본을 대문자로도 체크
  const upper = original.toUpperCase();
  if (aliasCandidates[upper]) candLists.push(aliasCandidates[upper]);

  for (const list of candLists) {
    for (const c of list) {
      if (centers[c]) return c;
    }
  }

  // 4) custom region이면 해당 키를 반환(별도 좌표 테이블에서 처리)
  if (customRegionCenters[original]) return original;
  if (n && customRegionCenters[n]) return n;

  // 5) 최후 fallback
  return n || original;
}
