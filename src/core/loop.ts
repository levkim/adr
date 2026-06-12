// requestAnimationFrame 기반 게임 루프. dt는 탭 비활성 복귀 시 폭주하지 않도록 클램프.
const MAX_DT = 0.05; // s

export function startLoop(update: (dt: number) => void): void {
  let last = performance.now();

  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, MAX_DT);
    last = now;
    update(dt);
    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
}
