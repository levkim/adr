import * as THREE from 'three';
import { Bear } from './bear';
import type { Terrain } from './terrain';

// 곰 추격 이벤트: 도착지 50% 거리 남았을 때 곰이 캐릭터 뒤 6m에서 따라오다가,
// 30% 남았을 때 진행방향 옆으로 유유히 달려가 사라진다.

type State = 'idle' | 'chase' | 'flee' | 'gone';

const GAP_FAST = 6; // m, 50km/h 초과 시 추격 거리
const GAP_SLOW = 3; // m, 50km/h 이하 시 추격 거리
const SPEED_KMH = 50; // 거리 전환 기준
const WEAVE_AMP = 2.2; // m, 뒤에서 좌우로 흔드는 폭
const WEAVE_FREQ = 2.6; // rad/s, 좌우 왕복 속도
const FLEE_SPEED = 9; // m/s, 유유히 달려가는 속도
const FLEE_AWAY = 42; // m, 이만큼 멀어지면 사라짐

export class BearEvent {
  private readonly bear = new Bear();
  private state: State = 'idle';
  private readonly pos = new THREE.Vector3();
  private readonly prev = new THREE.Vector3();
  private heading = 0;
  private weavePhase = 0;
  private readonly fleeDir = new THREE.Vector3();
  private fleeDist = 0;

  constructor(scene: THREE.Scene) {
    this.bear.group.visible = false;
    scene.add(this.bear.group);
  }

  reset(): void {
    this.state = 'idle';
    this.fleeDist = 0;
    this.weavePhase = 0;
    this.bear.group.visible = false;
  }

  /**
   * @param riderSpeed 라이더 속도(m/s) — 50km/h 기준 추격 거리 전환
   * @param distToFinish 현재 도착지까지 거리(m)
   * @param total 출발→도착 직선거리(m)
   */
  update(
    dt: number,
    riderPos: THREE.Vector3,
    riderHeading: number,
    riderSpeed: number,
    distToFinish: number,
    total: number,
    terrain: Terrain,
  ): void {
    if (this.state === 'gone') return;
    const frac = total > 0 ? distToFinish / total : 1;
    _fwd.set(Math.sin(riderHeading), 0, Math.cos(riderHeading));
    _side.set(_fwd.z, 0, -_fwd.x); // 오른쪽

    if (this.state === 'idle') {
      if (frac <= 0.5 && frac > 0.3) {
        this.pos.copy(riderPos).addScaledVector(_fwd, -GAP_FAST);
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
      this.weavePhase += dt * WEAVE_FREQ;
      const gap = riderSpeed * 3.6 > SPEED_KMH ? GAP_FAST : GAP_SLOW;
      // 캐릭터 뒤 gap 지점 + 좌우 위빙
      _t.copy(riderPos)
        .addScaledVector(_fwd, -gap)
        .addScaledVector(_side, Math.sin(this.weavePhase) * WEAVE_AMP);
      _t.y = terrain.getHeight(_t.x, _t.z);
      this.pos.lerp(_t, 1 - Math.exp(-6 * dt));
      this.pos.y = terrain.getHeight(this.pos.x, this.pos.z);
      if (frac <= 0.3) {
        this.fleeDir.copy(_side).addScaledVector(_fwd, 0.35).normalize();
        this.state = 'flee';
        this.fleeDist = 0;
      }
    } else if (this.state === 'flee') {
      this.pos.addScaledVector(this.fleeDir, FLEE_SPEED * dt);
      this.pos.y = terrain.getHeight(this.pos.x, this.pos.z);
      this.fleeDist += FLEE_SPEED * dt;
      if (this.fleeDist > FLEE_AWAY) {
        this.state = 'gone';
        this.bear.group.visible = false;
        return;
      }
    }

    // 이동 방향으로 머리 향하기 + 다리 애니메이션
    _dir.copy(this.pos).sub(this.prev);
    const moved = _dir.length() / Math.max(dt, 1e-4);
    if (_dir.lengthSq() > 1e-5) this.heading = Math.atan2(_dir.x, _dir.z);
    this.prev.copy(this.pos);
    this.bear.group.position.copy(this.pos);
    this.bear.group.rotation.y = this.heading;
    this.bear.update(dt, moved);
  }
}

const _fwd = new THREE.Vector3();
const _t = new THREE.Vector3();
const _side = new THREE.Vector3();
const _dir = new THREE.Vector3();
