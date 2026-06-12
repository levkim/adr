// 모든 튜닝 파라미터. lil-gui로 런타임 조정 가능해야 하므로 mutable 객체로 둔다.
export const CONFIG = {
  rider: {
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
    airDrag: 0.0045, // 공기저항 계수 k (감속 = k·v²) → 35° 사면 터미널 ~34m/s
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
  surface: {
    snowMaxSlopeDeg: 38, // 이 경사까지는 완전 설면
    rockMinSlopeDeg: 52, // 이 경사부터는 완전 암벽
    snowColor: '#eef3f8',
    rockColor: '#5a544e',
  },
};
