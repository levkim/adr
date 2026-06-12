import * as THREE from 'three';
import GUI from 'lil-gui';
import { CONFIG } from './config';
import { Input } from './core/input';
import { startLoop } from './core/loop';
import { RiderController } from './player/controller';
import { FollowCamera } from './camera/followCamera';
import { Hud } from './ui/hud';

// ── 렌더러 ──────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ── 씬 / 환경 ───────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ec3e6); // 블루버드 하늘 임시 톤
scene.fog = new THREE.Fog(0x9ec3e6, CONFIG.world.fogNear, CONFIG.world.fogFar);

const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(120, 180, 80);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -60;
sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60;
sun.shadow.camera.bottom = -60;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbcd8f5, 0xe8eef5, 0.8));

// ── 평평한 지면 (셋업 단계 — 2단계에서 실측 지형으로 교체) ──
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(CONFIG.world.groundSize, CONFIG.world.groundSize),
  new THREE.MeshStandardMaterial({ color: 0xf2f6fa, roughness: 0.95 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// 이동감 참고용 그리드 + 마커 (지형 들어오면 제거)
const grid = new THREE.GridHelper(
  CONFIG.world.groundSize,
  CONFIG.world.gridDivisions,
  0xb9c6d4,
  0xd6dee8,
);
grid.position.y = 0.01;
scene.add(grid);

const markerGeo = new THREE.ConeGeometry(0.6, 2.4, 8);
const markerMat = new THREE.MeshStandardMaterial({ color: 0x3a6ea5, roughness: 0.8 });
for (let i = 0; i < 40; i++) {
  const marker = new THREE.Mesh(markerGeo, markerMat);
  const range = CONFIG.world.groundSize * 0.45;
  marker.position.set((Math.random() * 2 - 1) * range, 1.2, (Math.random() * 2 - 1) * range);
  marker.castShadow = true;
  scene.add(marker);
}

// ── 라이더 / 카메라 / HUD ───────────────────────────────
const input = new Input();
const rider = new RiderController();
scene.add(rider.object);

const followCam = new FollowCamera(window.innerWidth / window.innerHeight);
followCam.snapTo(rider);

const hud = new Hud();

// ── 디버그 튜닝 ─────────────────────────────────────────
const gui = new GUI({ title: '튜닝' });
const riderFolder = gui.addFolder('라이더');
riderFolder.add(CONFIG.rider, 'accel', 1, 40);
riderFolder.add(CONFIG.rider, 'brakeDecel', 1, 60);
riderFolder.add(CONFIG.rider, 'friction', 0, 15);
riderFolder.add(CONFIG.rider, 'maxSpeed', 5, 50);
riderFolder.add(CONFIG.rider, 'turnRate', 0.5, 5);
riderFolder.add(CONFIG.rider, 'turnSpeedRef', 2, 20);
const camFolder = gui.addFolder('카메라');
camFolder.add(CONFIG.camera, 'distance', 3, 20);
camFolder.add(CONFIG.camera, 'height', 1, 10);
camFolder.add(CONFIG.camera, 'followLerp', 1, 12);
camFolder.close();

// ── 리사이즈 ────────────────────────────────────────────
window.addEventListener('resize', () => {
  followCam.camera.aspect = window.innerWidth / window.innerHeight;
  followCam.camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 그림자 카메라가 라이더를 따라다니도록
const sunOffset = sun.position.clone();

// ── 게임 루프 ───────────────────────────────────────────
startLoop((dt) => {
  rider.update(dt, input);
  followCam.update(dt, rider);
  hud.update(rider.speed);

  sun.position.copy(rider.object.position).add(sunOffset);
  sun.target.position.copy(rider.object.position);
  sun.target.updateMatrixWorld();

  renderer.render(scene, followCam.camera);
});
