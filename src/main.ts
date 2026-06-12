import * as THREE from 'three';
import GUI from 'lil-gui';
import { CONFIG } from './config';
import { Input } from './core/input';
import { startLoop } from './core/loop';
import { Terrain } from './world/terrain';
import { LOCATIONS } from './world/locations';
import { RiderController } from './player/controller';
import { CameraSystem, MODE_LABEL } from './camera/cameraSystem';
import { Hud } from './ui/hud';
import { GoggleOverlay } from './ui/goggleOverlay';
import { PowderFx } from './fx/powderFx';

async function main(): Promise<void> {
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

  // ── 실측 지형 ───────────────────────────────────────────
  // 장소 선택: ?loc=bec-des-rosses | hakuba-happo | valdez-thompson-pass
  // (시작 화면 UI는 9단계에서)
  const locId = new URLSearchParams(window.location.search).get('loc') ?? 'bec-des-rosses';
  if (!LOCATIONS[locId]) {
    throw new Error(`알 수 없는 장소: ${locId} (가능: ${Object.keys(LOCATIONS).join(', ')})`);
  }
  const terrain = await Terrain.load(locId);
  scene.add(terrain.buildMesh());
  console.log(
    `지형 로드: ${terrain.meta.nameEn} ${terrain.meta.width}x${terrain.meta.height}px, ` +
      `${terrain.meta.minElevation.toFixed(0)}~${terrain.meta.maxElevation.toFixed(0)}m`,
  );

  // ── 라이더 / 카메라 / HUD ───────────────────────────────
  const input = new Input();
  const rider = new RiderController();
  scene.add(rider.object);

  // 드랍 인 지점(정상)에 배치, 피니시 방향을 보게
  const startPos = terrain.geoToWorld(terrain.meta.start.lat, terrain.meta.start.lon);
  const finishPos = terrain.geoToWorld(terrain.meta.finish.lat, terrain.meta.finish.lon);
  const startHeading = Math.atan2(finishPos.x - startPos.x, finishPos.z - startPos.z);
  rider.spawnAt(startPos.x, startPos.z, startHeading, terrain);

  const cameraSystem = new CameraSystem(window.innerWidth / window.innerHeight);
  scene.add(cameraSystem.camera); // 1인칭 기어(카메라 자식) 렌더에 필요
  cameraSystem.snapTo(rider, terrain);

  const hud = new Hud();
  const goggle = new GoggleOverlay();
  const fx = new PowderFx(scene, cameraSystem.camera);

  // ── 디버그 튜닝 ─────────────────────────────────────────
  const gui = new GUI({ title: '튜닝' });
  const phyFolder = gui.addFolder('물리');
  phyFolder.add(CONFIG.rider, 'mass', 45, 120).name('몸무게 (kg)');
  phyFolder.add(CONFIG.physics, 'snowFriction', 0, 0.2);
  phyFolder.add(CONFIG.physics, 'brakeFriction', 0.1, 1);
  phyFolder.add(CONFIG.physics, 'airDrag', 0, 0.02);
  phyFolder.add(CONFIG.physics, 'edgeGrip', 0.5, 15);
  phyFolder.add(CONFIG.physics, 'headingAlign', 0, 5);
  phyFolder.add(CONFIG.physics, 'jumpSpeed', 1, 8);
  phyFolder.add(CONFIG.physics, 'crouchDragFactor', 0.2, 1);
  phyFolder.add(CONFIG.physics, 'launchFactor', 0.5, 3);
  const riderFolder = gui.addFolder('조향');
  riderFolder.add(CONFIG.rider, 'turnRate', 0.5, 5);
  riderFolder.add(CONFIG.rider, 'turnSpeedRef', 2, 30);
  riderFolder.add(CONFIG.rider, 'minTurnSpeed', 0.5, 10);
  riderFolder.add(CONFIG.physics, 'crouchTurnFactor', 0.2, 1);
  riderFolder.add(CONFIG.rider, 'slopeAlign', 0, 1).name('사면 정렬 비율');
  riderFolder.add(CONFIG.rider, 'leanMax', 0, 1.2).name('턴 린 최대(rad)');
  const camFolder = gui.addFolder('카메라');
  camFolder.add(CONFIG.camera, 'transitionTime', 0.2, 2);
  camFolder.add(CONFIG.camera.third, 'distance', 3, 20);
  camFolder.add(CONFIG.camera.third, 'height', 1, 10);
  camFolder.add(CONFIG.camera.third, 'followLerp', 1, 12);
  camFolder.add(CONFIG.camera.third, 'airPullback', 0, 8);
  camFolder.add(CONFIG.camera, 'shakeImpactScale', 0, 0.3);
  camFolder.add(CONFIG.camera, 'shakeMaxAmp', 0, 1);
  camFolder.close();
  const fpFolder = gui.addFolder('1인칭 (멀미 설정)');
  fpFolder.add(CONFIG.camera.first, 'motionIntensity', 0, 1).name('모션 강도');
  fpFolder.add(CONFIG.camera.first, 'bobAmp', 0, 0.1);
  fpFolder.add(CONFIG.camera.first, 'rollMax', 0, 0.3);
  fpFolder.add(CONFIG.camera.first, 'lookAhead', 0, 1);
  fpFolder.close();
  const fxFolder = gui.addFolder('연출');
  fxFolder.add(CONFIG.fx, 'screenIntensity', 0, 1).name('화면 효과 강도');
  fxFolder.add(CONFIG.fx.spray, 'baseRate', 0, 400);
  fxFolder.add(CONFIG.fx.spray, 'turnRateGain', 0, 800);
  fxFolder.add(CONFIG.fx.spray, 'opacity', 0, 1);
  fxFolder.add(CONFIG.fx.cameraSnow, 'ambientDensity', 0, 1).name('강설 분위기');
  fxFolder.add(CONFIG.fx.whiteroom, 'maxOpacity', 0, 1).name('화이트룸 최대');
  fxFolder.add(CONFIG.fx.audio, 'master', 0, 1).name('볼륨');
  fxFolder.close();

  // ── 리사이즈 ────────────────────────────────────────────
  window.addEventListener('resize', () => {
    cameraSystem.camera.aspect = window.innerWidth / window.innerHeight;
    cameraSystem.camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // 그림자 카메라가 라이더를 따라다니도록
  const sunOffset = sun.position.clone();

  // ── 게임 루프 ───────────────────────────────────────────
  startLoop((dt) => {
    // R: 드랍 인 지점으로 리셋
    if (input.justPressed('KeyR')) {
      rider.spawnAt(startPos.x, startPos.z, startHeading, terrain);
      cameraSystem.snapTo(rider, terrain);
    }

    rider.update(dt, input, terrain);
    cameraSystem.update(dt, input, rider, terrain);
    fx.update(dt, rider, cameraSystem);

    // 1인칭에서는 라이더 본체 숨김 + 고글 오버레이
    const isFirst = cameraSystem.modeId === 'first';
    rider.object.visible = !isFirst;
    goggle.setVisible(isFirst);
    hud.setCameraMode(MODE_LABEL[cameraSystem.modeId]);
    hud.update(rider.physics.speed, rider.physics.position.y + terrain.meta.minElevation);

    sun.position.copy(rider.object.position).add(sunOffset);
    sun.target.position.copy(rider.object.position);
    sun.target.updateMatrixWorld();

    renderer.render(scene, cameraSystem.camera);
    input.endFrame();
  });
}

main().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div style="position:fixed;inset:0;display:grid;place-items:center;color:#fff;background:#1a1d22;font-size:16px;padding:24px;text-align:center">${err}</div>`,
  );
});
