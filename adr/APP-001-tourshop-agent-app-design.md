# 더투어샵 독립 에이전트 앱 개발 설계
**문서 위치**: adr/APP-001-tourshop-agent-app-design.md
**작성일**: 2026-04-07
**상태**: 설계 확정

---

## 1. 개요

### 목표
Cowork 수동 운영(1단계)을 대체하는
Anthropic API 기반 독립 에이전트 앱 개발

### 핵심 원칙
```
사람이 할 일:
① 원본 파일을 raw/ 폴더에 저장
② 끝

나머지는 앱이 자동으로:
① 파일 감지
② 에이전트 실행
③ wiki 업데이트
④ 견적 서비스 제공
```

---

## 2. 시스템 구성

```
┌─────────────────────────────────────────────┐
│              더투어샵 에이전트 앱              │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ 백엔드    │  │ 에이전트  │  │ 프론트엔드│  │
│  │ (Node.js)│  │  엔진    │  │  (웹)   │  │
│  └──────────┘  └──────────┘  └──────────┘  │
│        │              │             │       │
│        └──────────────┼─────────────┘       │
│                       │                     │
│              Anthropic API                  │
│                       │                     │
│              tourshop-wiki DB               │
└─────────────────────────────────────────────┘
```

---

## 3. 기술 스택

### 백엔드
| 항목 | 기술 | 이유 |
|------|------|------|
| 언어 | Node.js | 빠른 개발·Anthropic SDK 지원 |
| 프레임워크 | Express.js | 가볍고 빠름 |
| 파일 감시 | chokidar | raw/ 폴더 변경 감지 |
| Anthropic | @anthropic-ai/sdk | 에이전트 실행 |
| DB | 파일 시스템 (MD) | 기존 wiki 구조 그대로 활용 |

### 프론트엔드
| 항목 | 기술 | 이유 |
|------|------|------|
| 프레임워크 | React | B2C·B2B·내부 채널 분리 용이 |
| 스타일 | Tailwind CSS | 빠른 UI 개발 |
| 상태관리 | Zustand | 가볍고 간단 |

---

## 4. 4개 핵심 모듈

### 모듈 1: 파일 감시 (File Watcher)
```
raw/ 폴더 감시
→ 새 파일 감지 시 자동 트리거
→ 파일 경로 기반 에이전트 자동 선택
→ 중복 처리 방지 (처리 이력 관리)

예)
raw/travelcost/hotel-rates/japan/ 에 파일 추가
→ hotel-rates 에이전트 자동 실행
→ 변환·저장·ingest 자동 처리
```

### 모듈 2: 에이전트 엔진 (Agent Engine)
```
CLAUDE.md 파일 자동 로드
→ Anthropic API 호출
→ 18개 에이전트 규칙 적용
→ 결과물 wiki/ 자동 저장
→ 처리 결과 로그 기록

채널별 마진율 자동 적용:
B2C → markup-guide.md 100% 적용
B2B → B2C에서 % 할인
내부 → 원가만
```

### 모듈 3: 견적 API (Quote API)
```
REST API 엔드포인트:
POST /api/quote
{
  "type": "ski",          // 여행 종류
  "country": "japan",     // 나라
  "destination": "niseko",// 여행지
  "nights": 5,            // 박수
  "persons": 10,          // 인원수
  "departure": "2026-12-20", // 출발일
  "channel": "b2c"        // 채널
}

→ wiki/costs/ 에서 원가 자동 조회
→ markup-guide.md 마진율 적용
→ 견적 결과 반환
```

### 모듈 4: 웹 서비스 (Web Service)
```
B2C 화면:
→ 여행 종류 선택
→ 나라·여행지 선택
→ 세부 항목 선택
→ 금액 실시간 표시
→ 견적서 다운로드

B2B 화면:
→ B2C와 동일 + 할인율 적용

내부 화면:
→ 원가 기반 견적
→ 마진 수동 추가
→ 담당자 관리 기능
```

---

## 5. 폴더 구조

```
tourshop-app/
├── backend/
│   ├── src/
│   │   ├── watcher/        ← 파일 감시 모듈
│   │   ├── agents/         ← 에이전트 엔진
│   │   ├── api/            ← REST API
│   │   └── wiki/           ← wiki 관리
│   ├── package.json
│   └── .env                ← ANTHROPIC_API_KEY 등
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── b2c/        ← B2C 고객 화면
│   │   │   ├── b2b/        ← B2B 여행사 화면
│   │   │   └── internal/   ← 내부 직원 화면
│   │   ├── components/
│   │   └── api/            ← 백엔드 API 연동
│   └── package.json
│
└── tourshop-wiki/          ← 기존 wiki DB (그대로 연결)
    ├── raw/
    └── wiki/
```

---

## 6. 개발 단계

### Phase 1 — 백엔드 핵심 (2~3주)
```
✅ 파일 감시 모듈
✅ 에이전트 엔진 (Anthropic API 연결)
✅ 견적 API 기본 버전
✅ wiki 자동 업데이트
```

### Phase 2 — 프론트엔드 (2~3주)
```
✅ B2C 견적 화면
✅ B2B 견적 화면
✅ 내부 관리 화면
✅ 여행안내서 웹 링크 페이지
```

### Phase 3 — 고도화 (지속)
```
✅ 챗봇 연동
✅ 카카오톡 알림
✅ 자동 견적서 PDF 생성
✅ 여행안내서 자동화 완성
```

---

## 7. 환경변수 (.env)

```
ANTHROPIC_API_KEY=sk-ant-...
WIKI_PATH=G:/tourshop-wiki
PORT=3000
B2B_DISCOUNT_RATE=0.15
```

---

## 8. 우선순위

백엔드 + 프론트엔드 **동시 개발**

```
Week 1~2: 파일 감시 + 에이전트 엔진
Week 2~3: 견적 API + B2C 화면 기본
Week 3~4: B2B·내부 화면 + 통합 테스트
Week 4~: 고도화 (챗봇·여행안내서)
```

---

## 9. 변경 이력

| 날짜 | 내용 | 작성자 |
|------|------|------|
| 2026-04-07 | 최초 작성 | |
