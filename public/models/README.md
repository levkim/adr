# 라이더 GLB 모델 / Rider GLB models

이 폴더에 라이더 모델을 넣으면 게임이 자동으로 사용합니다 (없으면 절차적 캐릭터로 폴백).
Drop rider models here; the game uses them automatically (falls back to procedural if absent).

- `snowboarder.glb` — 스노보더 (보드 장비 포함) / Snowboarder (board included)
- `skier.glb` — 스키어 (스키 장비 포함) / Skier (skis included)

규칙 / Notes
- 포맷: GLB(텍스처 포함). 정적 메시 OK (게임이 통째로 회전/기울기/플립 적용).
- 게임이 키 ~1.8m로 스케일 정규화하고, 발 바닥을 바닥에 맞춥니다.
- 정면(+Z, 진행 방향)을 보도록 내보내면 가장 좋습니다. 방향이 틀어지면 알려주세요(코드에서 회전 보정).
