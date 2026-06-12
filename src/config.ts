// 모든 튜닝 파라미터. lil-gui로 런타임 조정 가능해야 하므로 mutable 객체로 둔다.
export const CONFIG = {
  rider: {
    mass: 75, // kg, 라이더 몸무게 — 무거울수록 공기저항·(추후)파우더 저항의
    // 감속 효과가 작아져 터미널 속도가 올라간다. 중력 가속 자체는 질량 무관
    radius: 0.4, // m
    height: 1.7, // m
    turnRate: 1.8, // rad/s, 최대 조향 속도 (주행 카빙 기준 — 과회전 방지)
    turnSpeedRef: 8, // m/s, 이 속도 이상에서 조향이 점차 무뎌지기 시작
    minTurnSpeed: 3, // m/s, 이 속도 이하에서 조향이 점차 약해진다 (제자리 회전 방지)
    standstillTurnFactor: 0.35, // 정지 상태에서 남는 조향 비율 (드랍 인 전 방향 조정용)
    crouchVisualLerp: 8, // 1/s, 크라우치 자세 전환 속도
  },
  physics: {
    gravity: 9.81, // m/s²
    snowFriction: 0.045, // 운동 마찰계수 (다져진 눈)
    brakeFriction: 0.45, // 브레이크(S) 시 마찰계수 — 스피드 체크
    airDrag: 0.0045, // 공기저항 계수 k @ 기준체중 75kg (감속 = k·v²·75/체중)
    // → 75kg 기준 35° 사면 터미널 ~34m/s, 무거우면 더 빠르다
    massRef: 75, // kg, airDrag가 정의된 기준 체중
    edgeGrip: 5, // 1/s, 횡미끄럼이 보드 방향으로 수렴하는 속도 (카빙 그립)
    pushAccel: 2.5, // m/s², 평탄/저속에서 푸시(W) 가속
    pushMaxSpeed: 6, // m/s, 푸시로 낼 수 있는 최대 속도
    jumpSpeed: 3.8, // m/s, 점프 시 사면 법선 방향 속도 (체공은 경사·속도에서 자연 발생)
    crouchDragFactor: 0.45, // 크라우치 시 공기저항 배율 (턱 자세 가속)
    crouchFrictionFactor: 0.85, // 크라우치 시 마찰 배율
    crouchTurnFactor: 0.6, // 크라우치 시 조향 배율 (웅크리면 둔해진다)
    headingAlign: 1.2, // 1/s, 무조향 시 보드가 진행 방향으로 정렬되는 속도
    stickRatio: 0.4, // 이동 스텝 대비 지면 추종 한계 비율 — 지면이 atan(0.4)≈22°보다
    // 급하게 꺼지면(클리프) 공중 판정. 스텝 비례라 프레임레이트 무관
    stickMin: 0.08, // m, 저속에서의 지면 추종 최소 한계
    launchFactor: 1.0, // 롤오버 런치 민감도 — 원심 조건 v·ω > g·n.y·factor.
    // 낮을수록 볼록 지형에서 쉽게 뜬다
    uphillSnap: 1.2, // m, 오르막 단차를 지면 추종으로 흡수하는 한계
  },
  camera: {
    fov: 70,
    far: 20000, // 산 전체(~5km)가 보여야 함
    transitionTime: 0.8, // s, 모드 전환 보간 시간
    fovLerp: 3, // 1/s, FOV 보간 속도
    terrainClearance: 1.5, // m, 카메라가 지면 아래로 파고들지 않는 최소 높이
    shakeImpactScale: 0.09, // 착지 충격(m/s) → 셰이크 강도 변환
    shakeMaxAmp: 0.45, // m, 셰이크 최대 진폭
    shakeDecay: 5, // 1/s, 셰이크 감쇠
    // ── 3인칭 추적 (기본) ──
    third: {
      distance: 8, // 라이더 후방 기본 거리 (m)
      height: 3.2, // 라이더 기준 카메라 높이 (m)
      lookAtHeight: 1.2, // 시선이 향하는 라이더 위 지점 (m)
      followLerp: 4, // 위치 보간 속도 (1/s)
      distanceSpeedGain: 0.1, // m per (m/s), 속도에 따른 거리 증가
      fovSpeedGain: 0.35, // deg per (m/s), 속도에 따른 FOV 증가
      fovMaxBoost: 14, // deg, FOV 증가 상한
      airPullback: 3, // m, 점프/체공 시 추가 풀백
    },
    // ── 1인칭 고글 뷰 ──
    first: {
      headHeight: 1.55, // m, 시점 높이 (크라우치 시 낮아짐)
      crouchDrop: 0.45, // m, 완전 크라우치 시 시점 하강
      fovBoost: 8, // deg, 1인칭 기본 FOV 가산
      fovSpeedGain: 0.2,
      fovMaxBoost: 8,
      motionIntensity: 0.7, // 0~1, 헤드 모션 전체 강도 (멀미 방지 설정)
      bobAmp: 0.035, // m, 주행 바운스 진폭
      bobFreq: 1.6, // Hz @ 10m/s (속도 비례)
      rollMax: 0.1, // rad, 턴 시 헤드 롤
      lookAhead: 0.45, // 시선이 속도 방향을 따라가는 비율 (0=보드 방향만)
      shakeFactor: 0.35, // 착지 셰이크 감쇠 배율 (1인칭은 과하면 멀미)
    },
    // ── 숄더 캠 ──
    shoulder: {
      back: 2.6, // m
      up: 1.55, // m
      side: 0.55, // m, 어깨 측면 오프셋
      lookAtHeight: 1.1,
      followLerp: 9, // 근접 시점은 빠르게 따라붙어야 한다
      fovBoost: 4,
      fovSpeedGain: 0.25,
      fovMaxBoost: 10,
    },
    // ── 드론/시네마틱 ──
    drone: {
      ahead: 26, // m, 진행 방향 앞
      side: 20, // m, 측면
      height: 11, // m
      followLerp: 1.4, // 묵직하게 떠다니는 느낌
      fov: 44, // 망원 느낌 고정
    },
  },
  world: {
    edgeMargin: 30, // 지형 가장자리 접근 제한 (m)
    fogNear: 3000,
    fogFar: 9000,
  },
  fx: {
    screenIntensity: 0.8, // 0~1, 모든 화면 효과 마스터 (가독성/멀미 배려)
    // ── 월드 파우더 스프레이 (GPU 파티클 풀) ──
    spray: {
      poolSize: 4000,
      baseRate: 110, // 입자/초, 직활강 기준속도에서
      turnRateGain: 320, // 턴 강도(|steer|·속도) 비례 추가 방출
      landingBurst: 70, // 착지 충격(m/s)당 버스트 입자 수
      speedRef: 20, // m/s, 방출량 기준 속도
      minSpeed: 2.5, // m/s, 이하에서는 방출 없음
      size: 0.5, // m, 기본 입자 크기
      sizeJitter: 0.6,
      expand: 2.2, // 수명 동안 크기 팽창 배율
      life: 0.85, // s
      lifeJitter: 0.5,
      upVel: 2.4, // m/s, 위로 차오르는 속도
      sideVel: 3.0, // m/s, 턴 바깥쪽 분사
      inheritVel: 0.4, // 라이더 속도 계승 비율
      gravity: 5.0, // 파우더 입자 유효 중력 (공기저항 근사로 실중력보다 작게)
      bodyEmitterRatio: 0.3, // 라이더 몸 주변 보조 이미터 비중
      opacity: 0.75,
    },
    // ── 카메라 부착 근접 파티클 (전방 원뿔) ──
    cameraSnow: {
      poolSize: 800,
      budgets: { first: 800, shoulder: 600, third: 280, drone: 60 }, // 모드별 예산
      coneDepth: 9, // m
      coneSpread: 0.6,
      windFactor: 1.0, // 속도 → 입자 스트리밍 속도
      size: 0.03, // m
      ambientDensity: 0.18, // 정지 시 기본 밀도 (바람·강설 분위기)
      opacity: 0.55,
    },
    // ── 고글 스플래터/김서림 (스크린 스페이스, 1인칭) ──
    splatter: {
      maxBlobs: 28,
      spawnRate: 9, // 블롭/초, 스프레이 최대 강도에서
      life: 2.6, // s, 녹아 사라지는 시간
      lifeJitter: 1.4,
      minR: 7, // px
      maxR: 30,
      slide: 30, // px/s², 녹으며 흘러내리는 가속
      fogGain: 0.5, // 김서림 누적 속도
      fogDecay: 0.45, // 1/s
      fogMaxOpacity: 0.28,
    },
    // ── 화이트룸 (고속 주행 시 시야 눈 덮임) ──
    whiteroom: {
      speedMin: 13, // m/s, 시작
      speedMax: 27, // m/s, 최대
      maxOpacity: 0.5,
      attack: 1.8, // 1/s
      release: 2.4,
      // 모드별 반영 배율 (1인칭·숄더가 핵심)
      modeFactor: { first: 1.0, shoulder: 0.8, third: 0.25, drone: 0 },
    },
    // ── 절차 생성 사운드 (WebAudio, 에셋 없음) ──
    audio: {
      master: 0.65,
      wind: 0.9, // 속도 연동 바람
      slush: 0.8, // 파우더 슬러시
      carve: 0.7, // 에지 카빙 히스
      impact: 0.9, // 착지 임팩트
      breath: 0.4, // 1인칭 호흡
    },
  },
  surface: {
    snowMaxSlopeDeg: 38, // 이 경사까지는 완전 설면
    rockMinSlopeDeg: 52, // 이 경사부터는 완전 암벽
    snowColor: '#eef3f8',
    rockColor: '#5a544e',
  },
};
