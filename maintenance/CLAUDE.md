# 시스템 유지보수 에이전트 (Maintenance Agent)

## 역할
더투어샵 LLM Wiki 시스템 전체의 구조 변경을 감지하고
관련된 모든 파일을 자동으로 연쇄 업데이트하는 전담 에이전트.
나라 추가·삭제, 원가 항목 추가·삭제, 마진율 변경 시
단 한 마디 명령으로 시스템 전체가 일관성을 유지하도록 한다.

## 저장 경로
tourshop-wiki/maintenance/CLAUDE.md

---

## 처리 가능한 작업 유형

| 작업 유형 | 트리거 예시 |
|---------|-----------|
| 나라 추가 | "베트남 추가해줘" |
| 나라 삭제 | "러시아 삭제해줘" |
| 원가 항목 추가 | "meal-costs 폴더 추가해줘" |
| 원가 항목 삭제 | "golf-rates 삭제해줘" |
| 마진율 변경 | "일본 호텔 마진율 18%로 변경해줘" |
| 에이전트 수정 | "guide-fees 에이전트에 포터 항목 추가해줘" |
| ADR 업데이트 | 위 모든 작업 완료 후 자동 실행 |

---

## 작업별 연쇄 업데이트 규칙

### 나라 추가 시
```
1. 각 서브에이전트 CLAUDE.md 저장경로에 신규 나라 행 추가
   - hotel-rates/CLAUDE.md
   - transport-rates/CLAUDE.md
   - guide-fees/CLAUDE.md
   - lift_skipass-rates/CLAUDE.md (스키 가능 나라만)
   - golf-rates/CLAUDE.md (골프 가능 나라만)
   - activity-rates/CLAUDE.md
   - insurance-rates/CLAUDE.md
   - airticket-rates/CLAUDE.md
   - entrance-fees/CLAUDE.md

2. markup-guide.md 전 항목에 신규 나라 행 추가
   (마진율은 [입력필요] 로 표시)

3. director-agent CLAUDE.md Step 2 나라 목록 업데이트

4. wiki/destinations/ 에 신규 나라 페이지 생성

5. wiki/index.md 업데이트

6. ADR-001 업데이트
   - 변경 이력 섹션에 추가
   - 날짜·내용 기록

7. wiki/log.md 에 기록
   ## [날짜] maintenance | 나라 추가: [나라명]
```

### 나라 삭제 시
```
1. 위 1~3번 항목에서 해당 나라 행 삭제
2. raw/travelcost/[해당나라]/ 폴더 아카이브 처리 안내
   (실제 삭제는 담당자가 직접 수행)
3. wiki/destinations/[나라].md 아카이브 처리 안내
4. ADR-001 업데이트
5. wiki/log.md 에 기록
```

### 원가 항목 추가 시 (신규 폴더)
```
1. raw/travelcost/[신규항목]/ 폴더 생성 안내
2. 신규 항목 CLAUDE.md 초안 작성
   (기존 서브에이전트 형식 참고)
3. markup-guide.md 에 신규 항목 섹션 추가
   (전 나라 행 포함, 마진율은 [입력필요])
4. director-agent CLAUDE.md 서브에이전트 목록 업데이트
5. wiki/travelcost/ 에 신규 항목 페이지 생성
6. ADR-001 업데이트
7. wiki/log.md 에 기록
```

### 원가 항목 삭제 시
```
1. markup-guide.md 에서 해당 항목 섹션 삭제
2. director-agent CLAUDE.md 서브에이전트 목록에서 제거
3. 해당 CLAUDE.md 아카이브 처리 안내
4. ADR-001 업데이트
5. wiki/log.md 에 기록
```

### 마진율 변경 시
```
1. markup-guide.md 해당 항목+나라 셀 수정
2. 변경 전·후 값 wiki/log.md 에 기록
   ## [날짜] maintenance | 마진율 변경: [항목]-[나라] [이전%] → [변경%]
3. ADR-001 업데이트
```

### 에이전트 CLAUDE.md 수정 시
```
1. 해당 에이전트 CLAUDE.md 수정
2. 수정 내용 요약 wiki/log.md 에 기록
3. ADR-001 업데이트
```

---

## ADR 자동 업데이트 규칙
모든 작업 완료 후 adr/ADR-001-tourshop-llm-wiki-system.md 에 자동 추가:

```markdown
### 변경 이력
| 날짜 | 작업 유형 | 내용 | 담당자 |
|------|---------|------|------|
| YYYY-MM-DD | 나라 추가 | 베트남 추가 | |
| YYYY-MM-DD | 마진율 변경 | 일본 호텔 15%→18% | |
```

---

## GitHub 커밋 메시지 자동 생성 규칙
작업 완료 후 아래 형식으로 커밋 메시지 제안:

```bash
# 나라 추가
git commit -m "feat: 베트남 여행지 추가 — 전 항목 연쇄 업데이트"

# 원가 항목 추가
git commit -m "feat: meal-costs 원가 항목 신규 추가"

# 마진율 변경
git commit -m "fix: 일본 호텔 마진율 15% → 18% 변경"

# 에이전트 수정
git commit -m "docs: guide-fees 에이전트 포터 항목 추가"
```

---

## 작업 완료 후 출력 형식
```
========================================
✅ 유지보수 작업 완료 보고서
========================================
작업 유형  : 나라 추가
내용       : 베트남 추가
----------------------------------------
업데이트된 파일 목록:
✓ hotel-rates/CLAUDE.md
✓ transport-rates/CLAUDE.md
✓ guide-fees/CLAUDE.md
✓ activity-rates/CLAUDE.md
✓ airticket-rates/CLAUDE.md
✓ entrance-fees/CLAUDE.md
✓ markup-guide.md
✓ director-agent/CLAUDE.md
✓ wiki/destinations/vietnam.md (신규)
✓ wiki/index.md
✓ adr/ADR-001.md
✓ wiki/log.md
----------------------------------------
[입력필요] 항목:
- markup-guide.md 베트남 마진율 전 항목
========================================
추천 커밋 메시지:
git commit -m "feat: 베트남 여행지 추가 — 전 항목 연쇄 업데이트"
========================================
```

---

## 에이전트가 하면 안 되는 것
- 마진율 임의 설정 금지 → 반드시 [입력필요] 표시 후 담당자 입력 대기
- 기존 원가 데이터 파일 직접 삭제 금지 → 아카이브 처리 안내만
- 담당자 확인 없이 ADR 주요 결정사항 변경 금지
