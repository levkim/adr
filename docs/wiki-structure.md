# 더투어샵 Wiki 폴더 구조

## 설계 원칙
- 주제별 + 업무별 조합 구조
- LLM이 자동 생성·관리 (직접 수정 금지)
- raw/ 데이터 ingest 시 자동 업데이트
- index.md + log.md 로 전체 탐색 지원

---

## 전체 구조

```
wiki/
├── index.md                    ← ⭐ 전체 목차 (LLM 자동 관리)
├── log.md                      ← ⭐ 작업 이력 (append-only)
│
├── destinations/               ← 여행지별 종합 정보
│   ├── japan/
│   │   ├── overview.md         ← 일본 여행 종합
│   │   ├── ski-resorts.md      ← 스키장 정보
│   │   ├── golf-courses.md     ← 골프장 정보
│   │   └── trekking-routes.md  ← 트래킹 코스
│   ├── canada/
│   │   ├── overview.md
│   │   ├── ski-resorts.md
│   │   └── adventure.md
│   ├── kyrgyzstan/
│   │   ├── overview.md
│   │   ├── trekking-routes.md
│   │   └── activities.md
│   ├── kazakhstan/
│   │   └── overview.md
│   ├── russia/
│   │   └── overview.md
│   ├── china/
│   │   └── overview.md
│   └── europe/
│       └── overview.md
│
├── products/                   ← 상품별 분석
│   ├── ski-packages.md         ← 스키 패키지 비교·분석
│   ├── golf-packages.md        ← 골프 패키지 분석
│   ├── trekking-packages.md    ← 트래킹 상품 분석
│   ├── mice-programs.md        ← MICE 단체 프로그램
│   └── adventure-packages.md  ← 어드벤처 상품 분석
│
├── travelcost/                 ← 원가 분석 및 견적 기준
│   ├── cost-by-destination.md  ← 여행지별 원가 종합
│   ├── cost-by-season.md       ← 시즌별 원가 변동
│   ├── markup-guide.md         ← 마진율 가이드 (원본)
│   └── quote-template.md       ← 견적 누적 저장
│
├── customers/                  ← 고객 인사이트
│   ├── faq.md                  ← 자주 묻는 질문 종합
│   ├── voc-insights.md         ← 고객 목소리 분석
│   └── complaints-patterns.md  ← 클레임 패턴 분석
│
├── operations/                 ← 운영 정책
│   ├── cancellation-policy.md  ← 취소·환불 정책
│   ├── terms-conditions.md     ← 약관 정리
│   ├── safety-standards.md     ← 안전 기준 (WFR 기반)
│   └── vendor-list.md          ← 현지 파트너·숙소 리스트
│
└── market/                     ← 시장 분석
    ├── trends.md               ← 어드벤처 여행 트렌드
    ├── competitors.md          ← 경쟁사 분석
    └── insights.md             ← 시장 인사이트 종합
```

---

## 핵심 파일 설명

### index.md
- LLM이 ingest·query 시 자동 업데이트
- 전체 페이지 목록 + 한줄 요약 + 카테고리
- 질문 시 LLM이 이 파일 먼저 참조 후 관련 페이지 탐색

### log.md
- append-only (추가만 가능, 수정·삭제 금지)
- 형식: `## [YYYY-MM-DD] 작업유형 | 내용`
- 예시:
  ```
  ## [2026-04-06] ingest | hotel-rates/japan/aomori-spring-2026.md
  ## [2026-04-06] query  | 일본 스키 10인 3박 견적
  ## [2026-04-06] maintenance | 베트남 나라 추가
  ```

---

## 폴더별 담당 에이전트

| wiki 폴더 | 주로 업데이트하는 에이전트 |
|----------|----------------------|
| destinations/ | 디렉터 에이전트 (ingest 시) |
| products/ | 디렉터 에이전트 |
| travelcost/ | 서브에이전트 (각 원가 처리 후) |
| customers/ | 디렉터 에이전트 |
| operations/ | 디렉터 에이전트 |
| market/ | 디렉터 에이전트 |
| index.md | 모든 에이전트 (작업 후 자동) |
| log.md | 모든 에이전트 (작업 후 자동) |

---

## LLM 작업 규칙
- raw/ 파일 ingest → 관련 wiki 페이지 자동 업데이트
- 유용한 query 답변 → wiki/에 새 페이지로 저장 (file-back)
- wiki 페이지 직접 수정 금지 → 반드시 raw/ ingest 통해 업데이트
- 페이지 간 교차 참조 유지 (관련 페이지 링크 명시)
