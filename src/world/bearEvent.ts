import * as THREE from 'three';
import { Bear } from './bear';
import type { Terrain } from './terrain';

// 곰 추격 이벤트: 도착지 50% 거리 남았을 때 곰이 캐릭터 뒤 6m에서 따라오다가,
// 30% 남았을 때 진행방향 옆으로 유유히 달려가 사라진다.

type State = 'idle' | 'chase' | 'flee' | 'gone';

const CHASE_GAP = 6; // m, 뒤에서 따라오는 거리
const FLEE_SPEED = 9; // m/s, 유유히 달려가는 속도
const FLEE_AWAY = 42; // m, 이만큼 멀어지면 사라짐

export class BearEvent {
  private readonly bear = new Bear();
  private state: State = 'idle';
  private readonly pos = new THREE.Vector3();
  private readonly prev = new THREE.Vector3();
  private heading = 0;
  private readonly fleeDir = new THREE.Vector3();
  private fleeDist = 0;

  constructor(scene: THREE.Scene) {
    this.bear.group.visible = false;
    scene.add(this.bear.group);
  }

  reset(): void {
    this.state = 'idle';
    this.fleeDist = 0;
    this.bear.group.visible = false;
  }

  /**
   * @param distToFinish 현재 도착지까지 거리(m)
   * @param total 출발→도착 직선거리(m)
   */
  update(
    dt: number,
    riderPos: THREE.Vector3,
    riderHeading: number,
    distToFinish: number,
    total: number,
    terrain: Terrain,
  ): void {
    if (this.state === 'gone') return;
    const frac = total > 0 ? distToFinish / total : 1;
    _fwd.set(Math.sin(riderHeading), 0, Math.cos(riderHeading));

    if (this.state === 'idle') {
      // 50% 남은 시점에 캐릭터 뒤에서 등장
      if (frac <= 0.5 && frac > 0.3) {
        this.pos.copy(riderPos).addScaledVector(_fwd, -CHASE_GAP);
        this.pos.y = terrain.getHeight(this.pos.x, this.pos.z);
        this.prev.copy(this.pos);
        this.heading = riderHeading;
        this.state = 'chase';
        this.bear.group.visible = true;
      } else {
        return;
      }
    }

    if (this.state === 'chase') {
      // 캐릭터 뒤 6m 지점을 추종
      _t.copy(riderPos).addScaledVector(_fwd, -CHASE_GAP);
      _t.y = terrain.getHeight(_t.x, _t.z);
      this.pos.lerp(_t, 1 - Math.exp(-5 * dt));
      this.pos.y = terrain.getHeight(this.pos.x, this.pos.z);
      this.heading = riderHeading;
      if (frac <= 0.3) {
        // 진행방향 옆(오른쪽) + 약간 앞으로 → 유유히 이탈
        _side.set(_fwd.z, 0, -_fwd.x);
        this.fleeDir.copy(_side).addScaledVector(_fwd, 0.35).normalize();
        this.state = 'flee';
        this.fleeDist = 0;
      }
    } else if (this.state === 'flee') {
      this.pos.addScaledVector(this.fleeDir, FLEE_SPEED * dt);
      this.pos.y = terrain.getHeight(this.pos.x, this.pos.z);
      this.heading = Math.atan2(this.fleeDir.x, this.fleeDir.z);
      this.fleeDist += FLEE_SPEED * dt;
      if (this.fleeDist > FLEE_AWAY) {
        this.state = 'gone';
        this.bear.group.visible = false;
        return;
      }
    }

    // 위치/방향 반영 + 다리 애니메이션 (실제 이동 속도)
    const moved = this.pos.distanceTo(this.prev) / Math.max(dt, 1e-4);
    this.prev.copy(this.pos);
    this.bear.group.position.copy(this.pos);
    this.bear.group.rotation.y = this.heading;
    this.bear.update(dt, moved);
  }
}

const _fwd = new THREE.Vector3();
const _t = new THREE.Vector3();
const _side = new THREE.Vector3();
