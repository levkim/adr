import * as THREE from 'three';
import GUI from 'lil-gui';
import { CONFIG, type CharacterId } from './config';
import { Input } from './core/input';
import { TiltController } from './core/tilt';
import { startLoop } from './core/loop';
import { Terrain } from './world/terrain';
import { LOCATIONS } from './world/locations';
import { Props } from './world/props';
import { RiderController } from './player/controller';
import { CameraSystem, MODE_LABEL } from './camera/cameraSystem';
import { Hud } from './ui/hud';
import { GoggleOverlay } from './ui/goggleOverlay';
import { help } from './ui/guiHelp';
import { PowderFx } from './fx/powderFx';
import { Run } from './scoring/run';
import { ResultScreen } from './ui/resultScreen';
import { StartScreen, type Selection } from './ui/startScreen';
import { applyEnvironment, LIGHT_PRESETS } from './world/environment';
import { Sky } from './world/sky';
import { Minimap } from './ui/minimap';
import { Flags } from './world/flags';

async function main(): Promise<void> {
  // ── 렌더러 ──────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // 필름 톤매핑 — 밝은 설면이 날아가지 않고 자연스러운 대비 (노출은 프리셋별)
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  document.body.appendChild(renderer.domElement);

  // ── 씬 / 조명 셸 ────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9ec3e6);
  scene.fog = new THREE.Fog(0x9ec3e6, CONFIG.world.fogNear, CONFIG.world.fogFar);

  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -60;
  sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60;
  sun.shadow.camera.bottom = -60;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbcd8f5, 0xe8eef5, 0.8);
  scene.add(hemi);
  const sky = new Sky();
  scene.add(sky.mesh);

  // ── 선택: 딥링크(?loc=) 또는 시작 화면 ──────────────────
  const params = new URLSearchParams(window.location.search);
  const deepLoc = params.get('loc');
  let sel: Selection;
  if (deepLoc && LOCATIONS[deepLoc]) {
    const c = params.get('char');
    const l = params.get('light');
    sel = {
      loc: deepLoc,
      char: c && c in CONFIG.characters ? (c as CharacterId) : CONFIG.rider.character,
      light: l && LIGHT_PRESETS[l] ? l : 'bluebird',
    };
  } else {
    sel = await new StartScreen().choose();
  }
  CONFIG.rider.character = sel.char;
  const locId = sel.loc;

  // ── 실측 지형 ───────────────────────────────────────────
  const terrain = await Terrain.load(locId);
  const terrainMesh = terrain.buildMesh();
  terrainMesh.matrixAutoUpdate = false; // 정적 메시 — 매 프레임 행렬 갱신 생략
  scene.add(terrainMesh);

  // 시간대/광원 프리셋 적용
  let sunOffset = applyEnvironment(
    renderer,
    scene,
    sun,
    hemi,
    sky,
    LIGHT_PRESETS[sel.light] ?? LIGHT_PRESETS.bluebird,
  );
  sun.position.copy(sunOffset);

  // 나무/바위 절차 배치 (경사·고도 규칙, 시드 고정)
  const props = Props.generate(terrain, LOCATIONS[locId].treeline);
  scene.add(props.group);
  console.log(`절차 배치: 나무 ${props.treeCount}그루, 바위 ${props.rockCount}개`);

  // ── 라이더 / 카메라 / HUD ───────────────────────────────
  const input = new Input();
  const rider = new RiderController();
  scene.add(rider.object);

  // 스마트폰 기울기 조종 (옵트인) — 자이로 값을 Input에 주입
  const tilt = new TiltController(input);
  const tiltBtn = document.createElement('button');
  tiltBtn.textContent = '📱 기울기 (G)';
  tiltBtn.style.cssText = [
    'position:fixed',
    'right:16px',
    'bottom:36px',
    'z-index:8',
    'padding:7px 12px',
    'border:1px solid rgba(255,255,255,0.25)',
    'border-radius:8px',
    'background:rgba(20,24,30,0.7)',
    'color:#eef3f8',
    'font-size:13px',
    'cursor:pointer',
  ].join(';');
  tiltBtn.addEventListener('click', () => void tilt.toggle());
  document.body.appendChild(tiltBtn);

  // 드랍 인 지점(정상)에 배치, 피니시 방향을 보게
  const startPos = terrain.geoToWorld(terrain.meta.start.lat, terrain.meta.start.lon);
  const finishPos = terrain.geoToWorld(terrain.meta.finish.lat, terrain.meta.finish.lon);
  const startHeading = Math.atan2(finishPos.x - startPos.x, finishPos.z - startPos.z);
  const startAlt = terrain.getHeight(startPos.x, startPos.z) + terrain.meta.minElevation;
  const finishAlt = terrain.getHeight(finishPos.x, finishPos.z) + terrain.meta.minElevation;
  rider.spawnAt(startPos.x, startPos.z, startHeading, terrain);

  const cameraSystem = new CameraSystem(window.innerWidth / window.innerHeight);
  scene.add(cameraSystem.camera); // 1인칭 기어(카메라 자식) 렌더에 필요
  cameraSystem.snapTo(rider, terrain);

  // 시점 표시(HUD)를 탭하면 카메라 순환 (스마트폰)
  document.getElementById('hud-camera')?.addEventListener('click', () => cameraSystem.cycle());

  const hud = new Hud();
  const goggle = new GoggleOverlay();
  const fx = new PowderFx(scene, cameraSystem.camera);
  const minimap = new Minimap(terrain, startPos, finishPos);

  // 시작·베이스에 펄럭이는 tournski 깃발
  const flags = new Flags(terrain, startPos, finishPos);
  scene.add(flags.group);

  // ── 런 / 채점 / 결과 화면 ───────────────────────────────
  let run = new Run(finishPos, startAlt, finishAlt);
  const startRun = (): void => {
    rider.spawnAt(startPos.x, startPos.z, startHeading, terrain);
    cameraSystem.snapTo(rider, terrain);
    run = new Run(finishPos, startAlt, finishAlt);
    result.hide();
  };
  // '장소·캐릭터 변경' → 쿼리 제거 후 리로드 → 시작 화면
  const result = new ResultScreen(startRun, () => {
    window.location.href = window.location.pathname;
  });

  // ── 디버그 튜닝 ─────────────────────────────────────────
  const gui = new GUI({ title: '튜닝 / Tuning' });
  // 우측에서 펼쳐지고 접히는 슬라이드 패널 (스마트폰 배려). 터치 기기는 기본 접힘.
  setupGuiSlide(gui.domElement);
  // 캐릭터 선택 (4종 전환)
  const charFolder = gui.addFolder('캐릭터');
  const charOptions: Record<string, CharacterId> = {};
  for (const [id, p] of Object.entries(CONFIG.characters)) {
    charOptions[p.name] = id as CharacterId;
  }
  const charState = { character: CONFIG.rider.character };
  help(
    charFolder
      .add(charState, 'character', charOptions)
      .name('선택')
      .onChange((id: CharacterId) => {
        CONFIG.rider.character = id;
        rider.setCharacter(id);
      }),
    '라이더 캐릭터 4종(남/여 스키어, 남/여 스노보더)을 전환합니다. 스노보드/스키에 따라 장비와 자세가 바뀝니다.',
  );
  // 시간대/날씨 프리셋
  const envState = { light: sel.light };
  const lightOptions: Record<string, string> = {};
  for (const p of Object.values(LIGHT_PRESETS)) lightOptions[p.name] = p.id;
  help(
    charFolder
      .add(envState, 'light', lightOptions)
      .name('시간대/날씨')
      .onChange((id: string) => {
        sunOffset = applyEnvironment(renderer, scene, sun, hemi, sky, LIGHT_PRESETS[id]);
      }),
    '블루버드(쾌청)/아침(낮은 햇빛)/강설(흐림) 광원·하늘·안개·강설 분위기 프리셋.',
  );
  const phyFolder = gui.addFolder('물리');
  help(
    phyFolder.add(CONFIG.rider, 'mass', 45, 120).name('몸무게 (kg)'),
    '라이더 체중. 무거울수록 공기저항의 감속 효과가 상대적으로 작아져 최고 속도가 올라갑니다. 중력 가속 자체는 체중과 무관합니다.',
  );
  help(
    phyFolder.add(CONFIG.physics, 'snowFriction', 0, 0.2).name('설면 마찰'),
    '눈과 보드 사이 운동 마찰계수. 높이면 전반적으로 느려지고 관성이 빨리 죽습니다. 다져진 눈=낮음, 습설=높음.',
  );
  help(
    phyFolder.add(CONFIG.physics, 'airDrag', 0, 0.02).name('공기저항'),
    '속도 제곱에 비례하는 감속 계수. 최고 속도(터미널)를 결정합니다. 낮추면 더 빨라집니다.',
  );
  help(
    phyFolder.add(CONFIG.physics, 'edgeGrip', 0.5, 15).name('에지 그립'),
    '옆으로 미끄러지는 속도가 보드 방향으로 수렴하는 빠르기. 높으면 레일 탄 듯 정확한 카빙, 낮으면 드리프트처럼 미끄러집니다.',
  );
  help(
    phyFolder.add(CONFIG.physics, 'headingAlign', 0, 5).name('자동 정렬'),
    '조향하지 않을 때 보드가 진행 방향으로 저절로 정렬되는 속도. 0이면 보드 방향이 그대로 유지됩니다.',
  );
  help(
    phyFolder.add(CONFIG.physics, 'jumpSpeed', 1, 8).name('점프력'),
    'Space 점프 시 사면에서 수직으로 튀어오르는 초기 속도(m/s). 체공 시간·거리는 경사와 주행 속도에 따라 달라집니다.',
  );
  help(
    phyFolder.add(CONFIG.physics, 'crouchDragFactor', 0.2, 1).name('크라우치 드래그'),
    '크라우치(턱) 자세에서 공기저항 배율. 낮을수록 웅크렸을 때 가속 효과가 큽니다.',
  );
  help(
    phyFolder.add(CONFIG.physics, 'launchFactor', 0.5, 3).name('롤오버 런치'),
    '볼록한 지형(롤오버)에서 공중으로 뜨는 민감도. 낮추면 둔덕마다 쉽게 뜨고, 높이면 지면에 더 달라붙습니다.',
  );
  const snowFolder = gui.addFolder('파우더 스노우');
  help(
    snowFolder
      .add(CONFIG.snow, 'depth', { '30cm (기본)': 0.3, '60cm': 0.6, '90cm': 0.9, '120cm': 1.2 })
      .name('신설 깊이'),
    '쌓인 파우더 깊이. 깊을수록 저항이 커져 앞쏠림(W) 없이는 출발이 어렵고, 그립이 줄어 부유감이 커지며, 착지가 부드러워지고 스프레이가 커집니다.',
  );
  help(
    snowFolder.add(CONFIG.snow, 'powderDrag', 0, 15).name('파우더 저항'),
    '깊이 1m당 보드가 눈을 밀고 가는 감속(m/s²). 90cm 기준 중립 자세로는 급사면에서도 출발이 안 되는 수준이 기본값입니다.',
  );
  help(
    snowFolder.add(CONFIG.snow, 'foreLeanReduce', 0, 1).name('앞쏠림 효과'),
    'W(앞쏠림)가 파우더 저항을 줄이는 비율. S(뒤쏠림)는 같은 비율로 저항을 늘려 파우더 브레이크가 됩니다.',
  );
  help(
    snowFolder.add(CONFIG.snow, 'planeSpeed', 5, 30).name('플레이닝 속도'),
    '이 속도(m/s)에 가까워질수록 보드가 눈 위로 떠올라 저항이 줄어듭니다. 낮추면 쉽게 떠서 빨라집니다.',
  );
  help(
    snowFolder.add(CONFIG.snow, 'floatGripLoss', 0, 1).name('그립 손실'),
    '깊이 1m당 에지 그립 손실. 깊은 눈에서 턴이 미끄러지듯 무뎌지는 부유감을 만듭니다.',
  );
  const riderFolder = gui.addFolder('조향');
  help(
    riderFolder.add(CONFIG.rider, 'turnRate', 0.5, 5).name('턴 속도'),
    '최대 조향 각속도(rad/s). 높이면 민첩하지만 과회전으로 라인이 죽기 쉽습니다.',
  );
  help(
    riderFolder.add(CONFIG.rider, 'turnSpeedRef', 2, 30).name('턴 둔화 기준속도'),
    '이 속도(m/s)를 넘으면 조향이 점차 무뎌져 회전 반경이 커집니다. 실제 카빙처럼 고속에서 큰 호를 그리게 합니다.',
  );
  help(
    riderFolder.add(CONFIG.rider, 'minTurnSpeed', 0.5, 10).name('저속 턴 게이트'),
    '이 속도(m/s) 이하에서는 조향이 점차 약해집니다. 제자리 스핀을 방지합니다.',
  );
  help(
    riderFolder.add(CONFIG.physics, 'crouchTurnFactor', 0.2, 1).name('크라우치 턴 배율'),
    '크라우치 중 조향 배율. 웅크리면 빨라지는 대신 둔해지는 트레이드오프입니다.',
  );
  help(
    riderFolder.add(CONFIG.rider, 'slopeAlign', 0, 1).name('사면 정렬 비율'),
    '몸이 사면 법선에 맞춰 기우는 비율. 0=완전 수직(중력 정렬), 1=경사면에 90도. 실제 라이더는 0.2~0.3 정도가 자연스럽습니다.',
  );
  help(
    riderFolder.add(CONFIG.rider, 'leanMax', 0, 1.2).name('턴 린 최대(rad)'),
    '턴 시 원심력 균형으로 몸이 턴 안쪽으로 기우는 최대 각도. 0.6≈34°.',
  );
  help(
    riderFolder.add(CONFIG.rider, 'airTurnRate', 1, 8).name('공중 스핀 속도'),
    '공중에서 좌우 키로 회전하는 속도(rad/s). 높이면 360/720 스핀이 쉬워집니다.',
  );
  const camFolder = gui.addFolder('카메라');
  help(
    camFolder.add(CONFIG.camera, 'transitionTime', 0.2, 2).name('전환 시간'),
    'C 키로 카메라 모드를 바꿀 때 보간에 걸리는 시간(초).',
  );
  help(
    camFolder.add(CONFIG.camera.third, 'distance', 3, 20).name('3인칭 거리'),
    '3인칭 카메라의 라이더 후방 기본 거리(m). 속도가 붙으면 자동으로 더 멀어집니다.',
  );
  help(
    camFolder.add(CONFIG.camera.third, 'height', 1, 10).name('3인칭 높이'),
    '3인칭 카메라가 라이더보다 높이 떠 있는 정도(m).',
  );
  help(
    camFolder.add(CONFIG.camera.third, 'followLerp', 1, 12).name('추적 반응'),
    '카메라가 라이더를 따라붙는 속도. 낮으면 묵직하게 끌려오고, 높으면 딱 붙습니다.',
  );
  help(
    camFolder.add(CONFIG.camera.third, 'airPullback', 0, 8).name('체공 풀백'),
    '점프/체공 중 카메라가 추가로 빠지는 거리(m). 에어의 스케일감을 살립니다.',
  );
  help(
    camFolder.add(CONFIG.camera, 'shakeImpactScale', 0, 0.3).name('착지 셰이크 감도'),
    '착지 충격(m/s)을 화면 흔들림 강도로 바꾸는 비율. 0이면 셰이크 없음.',
  );
  help(
    camFolder.add(CONFIG.camera, 'shakeMaxAmp', 0, 1).name('셰이크 최대 진폭'),
    '착지 셰이크의 최대 흔들림 거리(m).',
  );
  camFolder.close();
  const fpFolder = gui.addFolder('1인칭 (멀미 설정)');
  help(
    fpFolder.add(CONFIG.camera.first, 'motionIntensity', 0, 1).name('모션 강도'),
    '1인칭 헤드 모션(바운스·롤·셰이크) 전체 강도. 멀미가 느껴지면 낮추세요. 0이면 완전 고정 시점.',
  );
  help(
    fpFolder.add(CONFIG.camera.first, 'bobAmp', 0, 0.1).name('바운스 진폭'),
    '주행 중 머리가 위아래로 흔들리는 진폭(m). 속도에 비례해 빨라집니다.',
  );
  help(
    fpFolder.add(CONFIG.camera.first, 'rollMax', 0, 0.3).name('턴 롤'),
    '턴 시 머리가 기우는 최대 각도(rad).',
  );
  help(
    fpFolder.add(CONFIG.camera.first, 'lookAhead', 0, 1).name('시선 선행'),
    '시선이 보드 방향 대신 실제 진행 방향을 따라가는 비율. 높이면 라인이 잘 보이고 멀미가 줄지만 보드 감각은 약해집니다.',
  );
  fpFolder.close();
  const fxFolder = gui.addFolder('연출');
  help(
    fxFolder.add(CONFIG.fx, 'screenIntensity', 0, 1).name('화면 효과 강도'),
    '스플래터·김서림·화이트룸·근접 눈입자 등 모든 화면 효과의 마스터 강도. 가독성이 떨어지거나 멀미가 나면 낮추세요.',
  );
  help(
    fxFolder.add(CONFIG.fx.spray, 'baseRate', 0, 400).name('스프레이 기본량'),
    '직활강 시 기본 파우더 스프레이 방출량(입자/초). 속도에 비례합니다.',
  );
  help(
    fxFolder.add(CONFIG.fx.spray, 'turnRateGain', 0, 800).name('턴 스프레이'),
    '턴 강도에 비례해 추가되는 스프레이 방출량. 카빙할 때 눈보라가 커집니다.',
  );
  help(
    fxFolder.add(CONFIG.fx.spray, 'opacity', 0, 1).name('스프레이 불투명도'),
    '파우더 입자의 진하기.',
  );
  help(
    fxFolder.add(CONFIG.fx.cameraSnow, 'ambientDensity', 0, 1).name('강설 분위기'),
    '정지 상태에서도 시야에 흩날리는 눈의 기본 밀도. 0=맑음(블루버드), 높이면 강설 분위기.',
  );
  help(
    fxFolder.add(CONFIG.fx.whiteroom, 'maxOpacity', 0, 1).name('화이트룸 최대'),
    '고속 주행 시 시야 하단을 덮는 백색 베일의 최대 농도. 1인칭·숄더에서 가장 강하게 적용됩니다.',
  );
  help(
    fxFolder.add(CONFIG.fx.audio, 'master', 0, 1).name('볼륨'),
    '전체 사운드 볼륨 (바람·슬러시·카빙·착지·호흡). 0이면 무음.',
  );
  fxFolder.close();
  const gFolder = gui.addFolder('기울기 조종 (폰)');
  help(
    gFolder.add(CONFIG.tilt, 'steerGain', 0.01, 0.2).name('조향 민감도'),
    '폰 좌우 기울기(도)를 조향으로 바꾸는 민감도.',
  );
  help(
    gFolder.add(CONFIG.tilt, 'leanGain', 0.01, 0.2).name('전후 민감도'),
    '폰 앞뒤 기울기(도)를 전후 체중이동으로 바꾸는 민감도.',
  );
  help(gFolder.add(CONFIG.tilt, 'invertSteer').name('조향 반전'), '좌우가 반대로 동작하면 켜세요.');
  help(gFolder.add(CONFIG.tilt, 'invertLean').name('전후 반전'), '앞/뒤가 반대로 동작하면 켜세요.');
  help(gFolder.add(CONFIG.tilt, 'swapAxes').name('가로모드(축교환)'), '폰을 가로로 들면 켜세요.');
  gFolder.add(CONFIG.tilt, 'deadzone', 0, 0.4).name('데드존');
  gFolder.add(CONFIG.tilt, 'smoothing', 1, 15).name('스무딩');
  gFolder.add({ recalibrate: () => tilt.requestCalibration() }, 'recalibrate').name('중립 재보정 (N)');
  gFolder.close();

  // ── 리사이즈 ────────────────────────────────────────────
  window.addEventListener('resize', () => {
    cameraSystem.camera.aspect = window.innerWidth / window.innerHeight;
    cameraSystem.camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ── 게임 루프 ───────────────────────────────────────────
  let elapsed = 0;
  startLoop((dt) => {
    elapsed += dt;
    flags.update(elapsed);
    sky.follow(cameraSystem.camera.position);
    // 설면 스파클 깜빡임 (셰이더 컴파일 후에만 존재)
    const tShader = (terrainMesh.material as THREE.Material).userData.shader;
    if (tShader) tShader.uniforms.uTime.value = elapsed;
    // R: 새 런 시작, M: 미니맵, G: 제스처 토글, N: 제스처 중립 재보정
    if (input.justPressed('KeyR')) startRun();
    if (input.justPressed('KeyM')) minimap.toggle();
    if (input.justPressed('KeyG')) void tilt.toggle();
    if (input.justPressed('KeyN')) tilt.requestCalibration();

    // 런 진행 중에만 물리/채점 갱신 (피니시 후에는 정지)
    if (run.state !== 'finished') {
      rider.update(dt, input, terrain, props);
      const frame = run.update(dt, rider, terrain);
      if (rider.physics.crashedThisFrame) hud.showPopup('낙상!');
      else if (frame.trick && frame.trick.landing !== 'crash') {
        hud.showPopup(frame.trick.label, 1300);
      }
      // 이번 프레임에 피니시했다면 결과 카드 표시 (run.result는 피니시 시에만 세팅)
      const card = run.result;
      if (card) result.show(card, run, terrain);
    }

    cameraSystem.update(dt, input, rider, terrain);
    fx.update(dt, rider, cameraSystem);

    // 1인칭에서는 라이더 본체 숨김 + 고글 오버레이
    const isFirst = cameraSystem.modeId === 'first';
    rider.object.visible = !isFirst;
    goggle.setVisible(isFirst);
    hud.setCameraMode(MODE_LABEL[cameraSystem.modeId]);
    hud.update(rider.physics.speed, rider.physics.position.y + terrain.meta.minElevation);
    hud.tickFps(dt);
    minimap.update(dt, rider.physics.position.x, rider.physics.position.z, rider.physics.heading);

    sun.position.copy(rider.object.position).add(sunOffset);
    sun.target.position.copy(rider.object.position);
    sun.target.updateMatrixWorld();

    renderer.render(scene, cameraSystem.camera);
    input.endFrame();
  });
}

// lil-gui 패널을 우측에서 슬라이드로 펼치고 접는다 (스마트폰 배려).
function setupGuiSlide(panel: HTMLElement): void {
  panel.style.transition = 'transform 0.28s ease';
  panel.style.zIndex = '9';
  panel.style.maxHeight = '100vh';
  panel.style.overflowY = 'auto';

  const tab = document.createElement('button');
  tab.style.cssText = [
    'position:fixed',
    'top:64px',
    'z-index:10',
    'padding:8px 11px',
    'border:1px solid rgba(255,255,255,0.25)',
    'border-right:0',
    'border-radius:8px 0 0 8px',
    'background:rgba(20,24,30,0.85)',
    'color:#eef3f8',
    'font-size:13px',
    'cursor:pointer',
    'transition:right 0.28s ease',
    '-webkit-tap-highlight-color:transparent',
  ].join(';');
  document.body.appendChild(tab);

  // 터치/좁은 화면은 기본 접힘
  let open = !window.matchMedia('(pointer: coarse), (max-width: 820px)').matches;
  const width = (): number => panel.getBoundingClientRect().width || 245;
  const apply = (): void => {
    panel.style.transform = open ? 'translateX(0)' : 'translateX(100%)';
    tab.style.right = open ? `${width()}px` : '0';
    tab.textContent = open ? '✕ 튜닝' : '⚙ 튜닝 / Tuning';
  };
  tab.addEventListener('click', () => {
    open = !open;
    apply();
  });
  requestAnimationFrame(apply); // 레이아웃 후 폭 측정
  window.addEventListener('resize', apply);
}

main().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div style="position:fixed;inset:0;display:grid;place-items:center;color:#fff;background:#1a1d22;font-size:16px;padding:24px;text-align:center">${err}</div>`,
  );
});
