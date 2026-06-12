// 모든 튜닝 파라미터. lil-gui로 런타임 조정 가능해야 하므로 mutable 객체로 둔다.
export const CONFIG = {
  rider: {
    radius: 0.4, // m
    height: 1.7, // m
    turnRate: 2.4, // rad/s, 최대 조향 속도
    turnSpeedRef: 10, // m/s, 이 속도 이상에서 조향이 점차 무뎌지기 시작
  },
  physics: {
    gravity: 9.81, // m/s²
    snowFriction: 0.045, // 운동 마찰계수 (다져진 눈)
    brakeFriction: 0.45, // 브레이크(S) 시 마찰계수 — 스피드 체크
    airDrag: 0.0045, // 공기저항 계수 k (감속 = k·v²) → 35° 사면 터미널 ~34m/s
    edgeGrip: 5, // 1/s, 횡미끄럼이 보드 방향으로 수렴하는 속도 (카빙 그립)
    pushAccel: 2.5, // m/s², 평탄/저속에서 푸시(W) 가속
    pushMaxSpeed: 6, // m/s, 푸시로 낼 수 있는 최대 속도
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
    distance: 8, // 라이더 후방 거리 (m)
    height: 3.2, // 라이더 기준 카메라 높이 (m)
    lookAtHeight: 1.2, // 시선이 향하는 라이더 위 지점 (m)
    followLerp: 4, // 위치 보간 속도 (1/s)
    terrainClearance: 1.5, // m, 카메라가 지면 아래로 파고들지 않는 최소 높이
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
