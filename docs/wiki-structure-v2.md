# 더투어샵 Wiki 폴더 구조 (v2)

## 설계 원칙
- **정보 유형 중심** 최상위 구조
- **여행지 폴더**는 해당 나라·지역의 모든 정보 유형을 통합
- LLM이 자동 생성·관리 (직접 수정 금지)
- index.md + log.md 로 전체 탐색 지원

---

## 전체 구조

```
wiki/
│
├── index.md                        ← ⭐ 전체 목차 (LLM 자동 관리)
├── log.md                          ← ⭐ 작업 이력 (append-only)
│
├── destinations/                   ← 여행지별 통합 정보
│   ├── japan/
│   │   ├── overview.md             ← 일본 종합 정보
│   │   ├── cost-summary.md         ← 여행지별 원가 요약
│   │   ├── products.md             ← 일본 상품 리스트
│   │   ├── voc.md                  ← 고객 VOC·리뷰
│   │   └── regions/
│   │       ├── hokkaido.md
│   │       ├── aomori.md
│   │       └── ...
│   ├── canada/
│   │   ├── overview.md
│   │   ├── cost-summary.md
│   │   ├── products.md
│   │   ├── voc.md
│   │   └── regions/
│   │       ├── british-columbia.md
│   │       └── ...
│   ├── kyrgyzstan/
│   ├── kazakhstan/
│   ├── russia/
│   ├── china/
│   └── europe/
│
├── products/                       ← 상품 유형별 분석
│   ├── ski-packages.md
│   ├── golf-packages.md
│   ├── trekking-packages.md
│   ├── adventure-packages.md
│   └── mice-programs.md
│
├── costs/                          ← 원가·견적·마진 기준
│   ├── markup-guide.md             ← 마진율 가이드 (원본)
│   ├── cost-by-destination.md      ← 여행지별 원가 종합
│   ├── cost-by-season.md           ← 시즌별 원가 변동
│   └── quotes/                     ← 견적 누적 저장
│       └── quote-log.md
│
├── customers/                      ← 고객 인사이트
│   ├── faq.md                      ← 자주 묻는 질문
│   ├── voc-insights.md             ← VOC 종합 분석
│   └── complaints-patterns.md      ← 클레임 패턴
│
├── operations/                     ← 운영 정책·기준
│   ├── cancellation-policy.md      ← 취소·환불 정책
│   ├── terms-conditions.md         ← 약관
│   ├── safety-standards.md         ← 안전 기준 (WFR)
│   └── vendor-list.md              ← 현지 파트너 리스트
│
├── market/                         ← 시장·경쟁 분석
│   ├── trends.md                   ← 여행 트렌드
│   ├── competitors.md              ← 경쟁사 분석
│   └── insights.md                 ← 시장 인사이트 종합
│
└── guides/                         ← 여행안내서 결과물
    └── [예약번호]/
        ├── guide-v1.md
        ├── guide-v2.md
        └── guide-v3.md
```

---

## 폴더별 담당 에이전트

| wiki 폴더 | 업데이트 담당 에이전트 |
|----------|-------------------|
| destinations/ | destinations + travelcost + products + customers |
| products/ | products 에이전트 |
| costs/ | 9개 travelcost 서브에이전트 |
| customers/ | customers 에이전트 |
| operations/ | policies 에이전트 |
| market/ | competitors + news 에이전트 |
| guides/ | travel-guide 에이전트 |
| index.md | 모든 에이전트 (작업 후 자동) |
| log.md | 모든 에이전트 (작업 후 자동) |

---

## destinations/ 구조 상세

여행지 폴더는 **해당 나라의 모든 정보 유형을 통합**합니다.

```
destinations/japan/
├── overview.md          ← 일본 종합 (기후·문화·교통·비자)
├── cost-summary.md      ← 일본 원가 요약 (호텔·교통·가이드 등)
├── products.md          ← 일본 상품 목록 + 간략 비교
├── voc.md               ← 일본 여행 고객 리뷰·VOC
└── regions/
    ├── hokkaido.md      ← 홋카이도 (스키장·액티비티·숙박)
    ├── aomori.md        ← 아오모리 (스키장·온천·숙박)
    └── tokyo.md         ← 도쿄 (골프·관광·쇼핑)
```

---

## costs/ 구조 상세

원가·견적 관련 정보를 한 곳에 모읍니다.

```
costs/
├── markup-guide.md         ← 항목+나라 조합 마진율 테이블
├── cost-by-destination.md  ← 여행지별 원가 종합 비교
├── cost-by-season.md       ← 월별·시즌별 원가 변동 분석
└── quotes/
    └── quote-log.md        ← 견적 이력 누적 저장
```

---

## log.md 기록 형식

```
## [YYYY-MM-DD] ingest | raw/travelcost/hotel-rates/japan/aomori-2026.md
## [YYYY-MM-DD] query  | 일본 스키 10인 4박 견적
## [YYYY-MM-DD] update | destinations/japan/cost-summary.md 갱신
## [YYYY-MM-DD] guide  | TRS2026001 여행안내서 v1 생성
## [YYYY-MM-DD] maintenance | 베트남 나라 추가
```

---

## 이전 버전 대비 변경사항

| 항목 | v1 | v2 |
|------|----|----|
| 최상위 구조 | 주제별 | 정보 유형 중심 |
| 여행지 정보 | destinations/만 | destinations/ 안에 원가·상품·VOC 통합 |
| 원가 폴더 | travelcost/ | costs/ 로 명칭 변경 |
| 견적 저장 | travelcost/quote-template.md | costs/quotes/quote-log.md |
| 여행안내서 | 없음 | guides/ 추가 |
