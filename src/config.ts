// 모든 튜닝 파라미터. lil-gui로 런타임 조정 가능해야 하므로 mutable 객체로 둔다.
export const CONFIG = {
  rider: {
    radius: 0.4, // m
    height: 1.7, // m
    accel: 12, // m/s², 전진 입력 시
    brakeDecel: 18, // m/s², 후진/브레이크 입력 시
    friction: 3, // m/s², 무입력 시 자연 감속
    maxSpeed: 18, // m/s (약 65 km/h) — 활강 물리 전 임시값
    maxReverseSpeed: 3, // m/s
    turnRate: 2.2, // rad/s, 최대 조향 속도
    turnSpeedRef: 8, // m/s, 이 속도 이상에서 조향이 점차 무뎌지기 시작
  },
  camera: {
    fov: 70,
    far: 20000, // 산 전체(~5km)가 보여야 함
    distance: 7, // 라이더 후방 거리 (m)
    height: 3, // 라이더 기준 카메라 높이 (m)
    lookAtHeight: 1.2, // 시선이 향하는 라이더 위 지점 (m)
    followLerp: 4, // 위치 보간 속도 (1/s)
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
