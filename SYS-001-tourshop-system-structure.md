# 더투어샵 시스템 구조도
**문서 위치**: adr/SYS-001-tourshop-system-structure.md
**작성일**: 2026-04-06
**상태**: 확정

---

## 1. 시스템 개요

더투어샵 LLM Wiki 기반 지식 관리 + 에이전트 자동화 시스템

```
원본 자료 (raw/)
    ↓ ingest
LLM Wiki DB (wiki/)
    ↓ 연동
에이전트 팀 (18개)
    ↓ 서비스
B2C · B2B · 내부 앱/웹
```

---

## 2. 전체 폴더 구조

```
tourshop-wiki/
│
├── maintenance/
│   └── CLAUDE.md              ← 유지보수 에이전트
│
├── raw/
│   ├── CLAUDE.md              ← 디렉터 에이전트
│   │
│   ├── travelcost/            ← 원가 데이터
│   │   ├── hotel-rates/
│   │   │   ├── CLAUDE.md
│   │   │   └── [나라]/[파일].md
│   │   ├── transport-rates/
│   │   │   ├── CLAUDE.md
│   │   │   └── [나라]/[파일].md
│   │   ├── guide-fees/
│   │   │   ├── CLAUDE.md
│   │   │   └── [나라]/[파일].md
│   │   ├── lift_skipass-rates/
│   │   │   ├── CLAUDE.md
│   │   │   └── [나라]/[파일].md
│   │   ├── golf-rates/
│   │   │   ├── CLAUDE.md
│   │   │   └── [나라]/[파일].md
│   │   ├── activity-rates/
│   │   │   ├── CLAUDE.md
│   │   │   └── [나라]/[파일].md
│   │   ├── insurance-rates/
│   │   │   ├── CLAUDE.md
│   │   │   └── [종류]/[파일].md
│   │   ├── airticket-rates/
│   │   │   ├── CLAUDE.md
│   │   │   └── [나라]/[파일].md
│   │   └── entrance-fees/
│   │       ├── CLAUDE.md
│   │       └── [나라]/[파일].md
│   │
│   ├── destinations/
│   │   ├── CLAUDE.md
│   │   └── [나라]/[지역]/[주제]/[파일].md
│   │
│   ├── products/
│   │   ├── CLAUDE.md
│   │   └── [여행종류]/[나라]/[파일].md
│   │
│   ├── customers/
│   │   ├── CLAUDE.md
│   │   └── [유형]/[파일].md
│   │
│   ├── policies/
│   │   ├── CLAUDE.md
│   │   └── [정책유형]/[상품]/[파일].md
│   │
│   ├── competitors/
│   │   ├── CLAUDE.md
│   │   └── [경쟁사]/[여행종류]/[파일].md
│   │
│   ├── news/
│   │   ├── CLAUDE.md
│   │   └── [유형]/[파일].md
│   │
│   └── travel-guides/
│       ├── CLAUDE.md
│       └── [예약번호]/
│           ├── guide-v1.md
│           ├── guide-v2.md
│           └── guide-v3.md
│
├── wiki/
│   ├── index.md               ← 전체 목차 (LLM 자동 관리)
│   ├── log.md                 ← 작업 이력 (append-only)
│   ├── destinations/
│   ├── products/
│   ├── travelcost/
│   │   ├── cost-by-destination.md
│   │   ├── cost-by-season.md
│   │   ├── markup-guide.md
│   │   └── quote-template.md
│   ├── customers/
│   ├── operations/
│   └── market/
│
└── adr/
    ├── BIZ-001-tourshop-business-structure.md
    ├── SYS-001-tourshop-system-structure.md
    └── wiki-structure.md
```

---

## 3. 에이전트 구조도

```
┌─────────────────────────────────────────┐
│         유지보수 에이전트                 │
│    (maintenance/CLAUDE.md)              │
│  나라·항목 추가/삭제, 마진율 변경 자동화  │
└─────────────────┬───────────────────────┘
                  │ 전체 관리
┌─────────────────▼───────────────────────┐
│           디렉터 에이전트                 │
│         (raw/CLAUDE.md)                 │
│   B2C·B2B·내부 견적 총괄 + 채널별 마진  │
└──────┬──────────────────────────┬───────┘
       │                          │
       ▼                          ▼
┌──────────────┐         ┌──────────────────────┐
│ 원가 서브에이전트 (9개)  │  │  정보 서브에이전트 (7개) │
├──────────────┤         ├──────────────────────┤
│ hotel-rates  │         │ destinations         │
│ transport    │         │ products             │
│ guide-fees   │         │ customers            │
│ lift_skipass │         │ policies             │
│ golf-rates   │         │ competitors          │
│ activity     │         │ news                 │
│ insurance    │         │ travel-guide         │
│ airticket    │         └──────────────────────┘
│ entrance-fee │
└──────────────┘
```

---

## 4. 데이터 흐름

```
[외부 원본 자료]
PDF / 엑셀 / 이미지 / 텍스트
        │
        ▼
[raw/ 폴더 저장]
해당 에이전트 CLAUDE.md 규칙 적용
        │
        ▼
[ingest 처리]
표준 MD 템플릿 변환
        │
        ▼
[wiki/ 자동 업데이트]
index.md + log.md 갱신
        │
        ▼
[견적·서비스 생성]
디렉터 에이전트 → 서브에이전트 호출
        │
        ▼
[고객·담당자 공유]
B2C 앱 / B2B 포털 / 카카오톡 / 웹링크
```

---

## 5. 원가 데이터 통일 규칙

| 규칙 | 내용 |
|------|------|
| 날짜 형식 | YYYY-MM-DD (전 항목 통일) |
| 호텔 요금 기준 | 룸당 요금 통일 (1인당 → 룸당 환산) |
| 식사 표기 | 헤더에만 표기 (-, 조식, 석식, 조/석식) |
| 확인 불가 값 | `[확인필요]` 표시 |
| 마진율 기준 | 항목+나라 조합별 |

---

## 6. 에이전트 공통 금지 사항

- 원가 임의 추정 금지
- 통화 임의 환율 변환 금지
- 마진율 임의 적용 금지
- 담당자 확인 없이 기존 파일 덮어쓰기 금지
- `[확인필요]` 항목 있는 상태로 최종 발송 금지
- 고객 개인정보 원본 wiki 저장 금지

---

## 7. 유지보수 자동화

나라·항목 추가 시 한 마디 명령으로 자동 연쇄 업데이트:

```
"베트남 추가해줘"
        │
        ▼
① 9개 서브에이전트 CLAUDE.md 저장경로 추가
② markup-guide.md 전 항목 행 추가
③ 디렉터 에이전트 나라 목록 업데이트
④ wiki/destinations/ 신규 페이지 생성
⑤ wiki/index.md 업데이트
⑥ ADR 변경 이력 자동 기록
⑦ GitHub 커밋 메시지 자동 생성
```

---

## 8. GitHub 관리

**저장소 구조**
```
tourshop-wiki/ (GitHub 저장소)
├── 모든 폴더·파일
└── adr/ (설계 문서)
```

**커밋 메시지 규칙**
```
feat:  새 기능·에이전트 추가
fix:   오류 수정
docs:  ADR·문서 업데이트
data:  원가 데이터 추가·수정
```

---

## 9. 향후 기술 로드맵

### 1단계 (현재) — 로컬 운영
```
내 PC (Cowork + Claude Code)
→ tourshop-wiki 폴더
→ GitHub 백업
```

### 2단계 — 팀 공유
```
GitHub 공유
→ MCP 서버 로컬 운영
→ 팀원 접근 가능
```

### 3단계 — 클라우드 서비스
```
클라우드 서버 이전
→ API 서버 연결
→ B2C·B2B 앱·웹 서비스 연동
→ 호텔 원가 변환 웹 도구
```

---

## 10. 변경 이력

| 날짜 | 내용 | 작성자 |
|------|------|------|
| 2026-04-06 | 최초 작성 (에이전트 18개 정의 완료) | |
