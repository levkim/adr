// 캐릭터: 스노보더 / 스키어 2종 (public/models/{id}.glb 로 모델 교체, 없으면 절차적)
export type CharacterId = 'snowboarder' | 'skier';

export interface CharacterPreset {
  name: string;
  discipline: 'snowboard' | 'ski';
  jacket: string; // 재킷 색 (절차적 폴백·시작화면 칩 색)
  pants: string; // 팬츠 색
  goggle: string; // 고글 미러 틴트
  board: string; // 보드 톱시트 / 스키 톤
}

// 모든 튜닝 파라미터. lil-gui로 런타임 조정 가능해야 하므로 mutable 객체로 둔다.
export const CONFIG = {
  rider: {
    mass: 75, // kg, 라이더 몸무게 — 무거울수록 공기저항·(추후)파우더 저항의
    // 감속 효과가 작아져 터미널 속도가 올라간다. 중력 가속 자체는 질량 무관
    radius: 0.4, // m
    height: 1.7, // m
    turnRate: 1.8, // rad/s, 최대 조향 속도 (주행 카빙 기준 — 과회전 방지)
    turnSpeedRef: 8, // m/s, 이 속도 이상에서 조향이 점차 무뎌지기 시작
    airTurnRate: 5.5, // rad/s, 공중 회전 속도 (스핀 트릭 — 속도 감쇠 없음). 1.15s 체공이면 360°
    minTurnSpeed: 3, // m/s, 이 속도 이하에서 조향이 점차 약해진다 (제자리 회전 방지)
    standstillTurnFactor: 0.35, // 정지 상태에서 남는 조향 비율 (드랍 인 전 방향 조정용)
    crouchVisualLerp: 8, // 1/s, 크라우치 자세 전환 속도
    // 자세: 몸은 기본적으로 중력 방향 수직, 사면 정렬은 일부만 (무릎 흡수)
    slopeAlign: 0.25, // 0=완전 수직, 1=사면 법선 정렬
    leanMax: 0.6, // rad (~34°), 턴 린 최대 각
    leanResponse: 7, // 1/s, 린 반응 속도
    forePitchMax: 0.38, // rad (~22°), W/S 전후 기울기 최대 각
    foreLeanResponse: 5, // 1/s, 전후 기울기 반응 속도
    // 캐릭터 기본값 (URL ?char=snowboarder|skier, 시작 화면에서 선택)
    character: 'snowboarder' as CharacterId,
  },
  // ── 캐릭터 프리셋 (레퍼런스 4종) ──
  // tournski=자체 브랜드(헬멧 표기 O), 제3자 브랜드 로고는 형태만 참고하고 표기 안 함
  characters: {
    snowboarder: {
      name: '스노보더',
      discipline: 'snowboard',
      jacket: '#2f6fb0', // 블루
      pants: '#2a5f96',
      goggle: '#6fb6e6', // 블루 미러
      board: '#caa36b', // 우드톱
    },
    skier: {
      name: '스키어',
      discipline: 'ski',
      jacket: '#73777c', // 그레이
      pants: '#5c6065',
      goggle: '#aebfcc', // 실버 미러
      board: '#3a3f47', // 스키 톤
    },
  } satisfies Record<string, CharacterPreset>,
  // ── 파우더 스노우 (신설) — 기본 30cm, 30cm 단위 추가 설정 ──
  snow: {
    depth: 0.3, // m, 신설 깊이. 모든 파우더 물리의 기준
    powderDrag: 7, // m/s² per (m 깊이), 보드가 눈을 밀고 가는 저항 계수
    foreLeanReduce: 0.8, // 앞쏠림(+1)이 plow 저항을 줄이는 비율 → 앞쏠림 시 0.2배
    // 뒤쏠림(-1)은 같은 비율로 저항 증가(테일 플로우) → 1.8배 = 파우더 브레이크
    planeSpeed: 14, // m/s, 이 속도에 가까워질수록 보드가 떠올라 저항 감소
    minPlaning: 0.15, // 완전 플레이닝 시 남는 저항 비율
    floatGripLoss: 0.5, // 깊이(m)당 에지 그립 손실 (눈이 무너져 그립 감소)
    landingAbsorb: 0.6, // 깊이(m)당 착지 충격 흡수 비율 (파우더 쿠션)
  },
  physics: {
    gravity: 9.81, // m/s²
    snowFriction: 0.045, // 운동 마찰계수 (베이스 활주 저항)
    airDrag: 0.0045, // 공기저항 계수 k @ 기준체중 75kg (감속 = k·v²·75/체중)
    // → 75kg 기준 35° 사면 터미널 ~34m/s, 무거우면 더 빠르다
    massRef: 75, // kg, airDrag가 정의된 기준 체중
    edgeGrip: 5, // 1/s, 횡미끄럼이 보드 방향으로 수렴하는 속도 (카빙 그립)
    skateAccel: 3.5, // m/s², 저속에서 W(앞쏠림) 유지 시 스케이팅 추진 — 플랫/벤치 탈출용
    skateMaxSpeed: 4, // m/s, 스케이팅으로 낼 수 있는 최대 속도 (이 이상은 중력으로만)
    jumpSpeed: 3.8, // m/s, 점프 시 사면 법선 방향 속도 (체공은 경사·속도에서 자연 발생)
    flipRate: 5.5, // rad/s, 공중 플립(앞/뒤 공중제비) 회전 속도. 1.15s 체공이면 360°
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
    // ── 정면 뷰 (라이더를 마주봄) ──
    front: {
      distance: 7, // m, 진행 방향 앞 거리
      height: 2.0, // m
      lookAtHeight: 1.1,
      followLerp: 5,
      distanceSpeedGain: 0.1,
      fovSpeedGain: 0.3,
      fovMaxBoost: 12,
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
      budgets: { first: 800, shoulder: 600, third: 280, drone: 60, front: 280 }, // 모드별 예산
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
      modeFactor: { first: 1.0, shoulder: 0.8, third: 0.25, drone: 0, front: 0.3 },
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
  // ── 말 타기 (평지 탈출) ──
  horse: {
    maxSpeed: 16.7, // m/s ≈ 60km/h
    accel: 8, // m/s², 전진 입력 시
    brake: 14, // m/s², 후진 입력 시
    friction: 4, // m/s², 무입력 시 감속
    reverseMax: 2.5, // m/s, 후진 최대
    turnRate: 1.7, // rad/s, 조향
    promptSpeed: 3, // m/s(≈11km/h) 이하 + 평지면 프롬프트
    promptSlopeCos: 0.95, // 평지 판정 (지면 법선 y > 이값, ~18°)
    promptDelay: 1.3, // s, 느림 유지 시간
    promptCooldown: 8, // s, NO 후 재표시 안 함
  },
  // ── 절차 배치 (나무/바위) ──
  props: {
    spacing: 11, // m, 배치 후보 격자 간격
    hashCell: 24, // m, 충돌 공간 해시 셀 크기
    treeMaxSlope: 35, // deg, 이 경사 이상엔 나무가 못 자란다
    treeDensity: 0.5, // 수목한계선 충분히 아래에서의 배치 확률
    treeDensityRamp: 180, // m, 수목한계선 아래로 이 표고차에 걸쳐 밀도 증가
    treeCollisionRadius: 0.5, // m, 줄기 충돌 반경
    treeCollisionHeight: 3.0, // m, 이 높이 위로는 통과(점프로 넘기)
    maxTrees: 30000,
    rockMinSlope: 34, // deg, 바위 노출 시작 경사
    rockMaxSlope: 50, // deg
    rockDensity: 0.045,
    maxRocks: 4000,
  },
  // ── 낙상 ──
  crash: {
    duration: 2.2, // s, 낙상 후 일어나기까지
    friction: 0.5, // 낙상 슬라이딩 마찰계수 (빠르게 멈춤)
    invulnTime: 1.5, // s, 회복 직후 충돌 무시 (같은 장애물 연속 낙상 방지)
    minSpeed: 1.5, // m/s, 이 속도 이하로 느려져야 일어난다
  },
  // ── 점수 (FWT 채점 모방) ──
  scoring: {
    startSpeed: 1.5, // m/s, 이 속도를 넘으면 런 시작(타이머 가동)
    finishRadius: 50, // m, 피니시 도달 판정 반경
    trajSampleInterval: 0.22, // s, 라인 궤적 기록 간격
    trick: {
      minAirtime: 0.45, // s, 이보다 짧은 체공은 트릭으로 안 침
      cleanAngleDeg: 30, // 착지 시 보드-진행 정렬 오차가 이 이하면 클린
      wobbleAngleDeg: 70, // 이 이상이면 botched → 낙상
      airtimeStyle: 0.2, // 스타일 점수/초 체공
      rotationStyle: 0.0019, // 스타일 점수/도 회전
      grabBonus: 0.4, // 그랩 시 스타일 가산
      refStyle: 5.5, // 100점 정규화 기준 누적 스타일 (스핀·그랩 없는 맨 에어로는 만점 어렵게)
    },
    line: {
      steepStartDeg: 32, // 난이도 누적 시작 경사
      steepFullDeg: 52, // 최대 난이도 경사
      exposureRate: 16, // 난이도 누적 속도(점수/초) @ 최대 경사
      cliffWeight: 7, // 클리프(체공) 난이도 가중
      refDifficulty: 1000, // 100점 정규화 기준 누적 난이도
    },
    fluidity: {
      goodFlowSpeed: 8, // m/s, 이 이하 저속 주행이면 흐름 감점
      stallPenalty: 10, // 점수/초, 정지·저속
      reversePenalty: 20, // 점수/초, 역주행(오르막 진행)
      crashPenalty: 14, // 낙상 시 흐름 감점
    },
    control: {
      crashPenalty: 26, // 낙상 1회 감점
      wobblePenalty: 8, // 휘청 착지 1회 감점
    },
    weights: { line: 0.3, air: 0.25, fluidity: 0.2, control: 0.25 },
  },
  surface: {
    snowMaxSlopeDeg: 38, // 이 경사까지는 완전 설면
    rockMinSlopeDeg: 52, // 이 경사부터는 완전 암벽
    snowColor: '#eef3f8',
    rockColor: '#5a544e',
  },
};
