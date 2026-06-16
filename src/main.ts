import * as THREE from 'three';
import GUI from 'lil-gui';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { CONFIG, type CharacterId } from './config';
import { Input } from './core/input';
import { Joystick } from './ui/joystick';
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
import { BackgroundMusic } from './fx/bgm';
import { Run } from './scoring/run';
import { ResultScreen } from './ui/resultScreen';
import { StartScreen, type Selection } from './ui/startScreen';
import { HorsePrompt } from './ui/horsePrompt';
import { AdminEvent } from './ui/adminEvent';
import { applyEnvironment, LIGHT_PRESETS } from './world/environment';
import { Sky } from './world/sky';
import { BearEvent } from './world/bearEvent';
import { Minimap } from './ui/minimap';
import { Flags } from './world/flags';

async function main(): Promise<void> {
  // ── 관리자 이벤트 공지 (장소별, announcements.json + ?admin=1 패널) ──
  const admin = new AdminEvent();

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
  admin.setLocation(locId); // 장소별 공지 배너

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

  // 화면 터치 조이스틱 (옵트인) — 좌우=조향, 위아래=체중이동/플립, 탭=점프, 길게=그립
  const joystick = new Joystick(input);
  const joyBtn = document.createElement('button');
  joyBtn.textContent = '🕹 조이스틱 (J)';
  joyBtn.style.cssText = [
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
  document.body.appendChild(joyBtn);
  joyBtn.addEventListener('click', () => joystick.toggle());

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

  // 'How to control' 버튼 — 조작법 패널 펼침/접힘
  const helpBtn = document.getElementById('help-btn');
  const helpPanel = document.getElementById('help-panel');
  helpBtn?.addEventListener('click', () => {
    if (helpPanel) helpPanel.style.display = helpPanel.style.display === 'block' ? 'none' : 'block';
  });

  const hud = new Hud();
  const goggle = new GoggleOverlay();
  const fx = new PowderFx(scene, cameraSystem.camera);
  const minimap = new Minimap(terrain, startPos, finishPos);

  // 시작·베이스에 펄럭이는 tournski 깃발
  const flags = new Flags(terrain, startPos, finishPos);
  scene.add(flags.group);

  // 곰 추격 이벤트 (50% 등장 → 30% 옆으로 이탈)
  const bearEvent = new BearEvent(scene);
  const totalRunDist = Math.hypot(finishPos.x - startPos.x, finishPos.z - startPos.z);

  // ── 런 / 채점 / 결과 화면 ───────────────────────────────
  let run = new Run(finishPos, startAlt, finishAlt);
  const startRun = (): void => {
    rider.spawnAt(startPos.x, startPos.z, startHeading, terrain);
    cameraSystem.snapTo(rider, terrain);
    run = new Run(finishPos, startAlt, finishAlt);
    result.hide();
    horsePrompt.setMounted(false);
    horsePrompt.hidePrompt();
    updateHorseBtn();
    horseSlowT = 0;
    horseCooldown = 0;
    bearEvent.reset();
  };
  // '장소·캐릭터 변경' → 쿼리 제거 후 리로드 → 시작 화면
  const result = new ResultScreen(startRun, () => {
    window.location.href = window.location.pathname;
  });

  // 말 타기 프롬프트(평지 탈출)
  let horseSlowT = 0;
  let horseCooldown = 0;
  const horsePrompt = new HorsePrompt(
    () => {
      rider.mount();
      horsePrompt.setMounted(true);
      updateHorseBtn();
    },
    () => {
      horseCooldown = CONFIG.horse.promptCooldown;
    },
    () => {
      rider.dismount();
      horsePrompt.setMounted(false);
      updateHorseBtn();
    },
  );

  // 출발점 복귀 터치 버튼 — 상단 시점변경(📷) 버튼 오른편에 배치
  const resetBtn = document.createElement('button');
  resetBtn.textContent = '↩ 출발점';
  resetBtn.title = '드랍 인으로 복귀 (R)';
  resetBtn.style.cssText = [
    'position:fixed',
    'top:14px',
    'z-index:6',
    'padding:5px 10px',
    'border-radius:16px',
    'background:rgba(20,24,30,0.55)',
    'border:1px solid rgba(255,255,255,0.18)',
    'color:#eef3f8',
    'font-size:14px',
    'cursor:pointer',
    '-webkit-tap-highlight-color:transparent',
  ].join(';');
  document.body.appendChild(resetBtn);
  resetBtn.addEventListener('click', startRun);

  // 상시 '말타기' 토글 버튼 (출발점 버튼 오른편)
  const horseBtn = document.createElement('button');
  horseBtn.textContent = '🐴 말타기';
  horseBtn.title = 'Horse backcountry';
  horseBtn.style.cssText = resetBtn.style.cssText;
  document.body.appendChild(horseBtn);
  const updateHorseBtn = (): void => {
    horseBtn.textContent = rider.mounted ? '🐴 내리기' : '🐴 말타기';
  };
  horseBtn.addEventListener('click', () => {
    if (rider.mounted) rider.dismount();
    else rider.mount();
    horsePrompt.setMounted(rider.mounted);
    updateHorseBtn();
  });

  // 배경 음악 + 음소거 토글 버튼 (말타기 버튼 오른편)
  const bgm = new BackgroundMusic();
  const musicBtn = document.createElement('button');
  musicBtn.title = 'BGM on/off';
  musicBtn.style.cssText = resetBtn.style.cssText;
  const updateMusicBtn = (): void => {
    musicBtn.textContent = CONFIG.fx.music.enabled ? '🎵 음악' : '🔇 음악';
  };
  updateMusicBtn();
  document.body.appendChild(musicBtn);
  musicBtn.addEventListener('click', () => {
    bgm.toggle();
    updateMusicBtn();
  });

  // 상단 버튼들을 📷 시점 표시 오른쪽에 차례로 배치 (라벨 길이 변동 시 재배치)
  const camElForReset = document.getElementById('hud-camera');
  const placeTopBtns = (): void => {
    if (!camElForReset) return;
    const r = camElForReset.getBoundingClientRect();
    resetBtn.style.left = `${r.right + 8}px`;
    resetBtn.style.top = `${r.top}px`;
    const rr = resetBtn.getBoundingClientRect();
    horseBtn.style.left = `${rr.right + 8}px`;
    horseBtn.style.top = `${r.top}px`;
    const hr = horseBtn.getBoundingClientRect();
    musicBtn.style.left = `${hr.right + 8}px`;
    musicBtn.style.top = `${r.top}px`;
  };
  placeTopBtns();
  if (camElForReset) new ResizeObserver(placeTopBtns).observe(camElForReset); // 라벨 변경 시 재배치
  window.addEventListener('resize', placeTopBtns);

  // ── 디버그 튜닝 ─────────────────────────────────────────
  const gui = new GUI({ title: '튜닝 / Tuning' });
  // 우측에서 펼쳐지고 접히는 슬라이드 패널 (스마트폰 배려). 터치 기기는 기본 접힘.
  setupGuiSlide(gui.domElement);
  // 캐릭터 선택 (4종 전환)
  const charFolder = gui.addFolder('캐릭터 / Character');
  const charOptions: Record<string, CharacterId> = {};
  for (const [id, p] of Object.entries(CONFIG.characters)) {
    charOptions[p.name] = id as CharacterId;
  }
  const charState = { character: CONFIG.rider.character };
  help(
    charFolder
      .add(charState, 'character', charOptions)
      .name('선택 / Rider')
      .onChange((id: CharacterId) => {
        CONFIG.rider.character = id;
        rider.setCharacter(id);
      }),
    '라이더 4종(남/여 스키어·스노보더) 전환. EN: Switch rider — ski/board gear & stance.',
  );
  // 시간대/날씨 프리셋
  const envState = { light: sel.light };
  const lightOptions: Record<string, string> = {};
  for (const p of Object.values(LIGHT_PRESETS)) lightOptions[p.name] = p.id;
  help(
    charFolder
      .add(envState, 'light', lightOptions)
      .name('시간대·날씨 / Light')
      .onChange((id: string) => {
        sunOffset = applyEnvironment(renderer, scene, sun, hemi, sky, LIGHT_PRESETS[id]);
      }),
    '블루버드/아침/강설 광원·하늘·안개 프리셋. EN: Lighting preset (bluebird/morning/snowfall).',
  );
  const phyFolder = gui.addFolder('물리 / Physics');
  help(
    phyFolder.add(CONFIG.rider, 'mass', 45, 120).name('몸무게(kg) / Mass'),
    '무거울수록 공기저항 감속이 작아져 최고 속도↑(중력 가속은 무관). EN: Heavier = higher top speed.',
  );
  help(
    phyFolder.add(CONFIG.physics, 'snowFriction', 0, 0.2).name('설면 마찰 / Friction'),
    '눈-보드 마찰. 높이면 전반적으로 느려짐. EN: Snow friction; higher = slower.',
  );
  help(
    phyFolder.add(CONFIG.physics, 'airDrag', 0, 0.02).name('공기저항 / Air drag'),
    '속도² 비례 감속, 최고속도 결정. 낮추면 빨라짐. EN: Sets terminal speed; lower = faster.',
  );
  help(
    phyFolder.add(CONFIG.physics, 'edgeGrip', 0.5, 15).name('에지 그립 / Edge grip'),
    '높으면 정확한 카빙, 낮으면 드리프트. EN: High = railed carve, low = drifty.',
  );
  help(
    phyFolder.add(CONFIG.physics, 'headingAlign', 0, 5).name('자동 정렬 / Auto-align'),
    '무조향 시 보드가 진행 방향으로 정렬되는 속도. EN: Auto board-to-travel alignment.',
  );
  help(
    phyFolder.add(CONFIG.physics, 'jumpSpeed', 1, 8).name('점프력 / Jump'),
    '점프 초기 속도(m/s). 체공은 경사·속도에 좌우. EN: Jump impulse speed.',
  );
  help(
    phyFolder.add(CONFIG.physics, 'flipRate', 1, 9).name('플립 속도 / Flip rate'),
    '공중 앞/뒤(W/S·조이스틱 상하) 공중제비 속도. EN: Front/back flip spin rate in air.',
  );
  help(
    phyFolder.add(CONFIG.physics, 'crouchDragFactor', 0.2, 1).name('크라우치 드래그 / Tuck drag'),
    '크라우치 시 공기저항 배율. 낮을수록 턱 가속↑. EN: Tuck air-drag multiplier.',
  );
  help(
    phyFolder.add(CONFIG.physics, 'launchFactor', 0.5, 3).name('롤오버 런치 / Rollover'),
    '볼록 지형에서 뜨는 민감도. 낮추면 잘 뜸. EN: Pop sensitivity on convex terrain.',
  );
  const snowFolder = gui.addFolder('파우더 스노우 / Powder');
  help(
    snowFolder
      .add(CONFIG.snow, 'depth', { '30cm (기본)': 0.3, '60cm': 0.6, '90cm': 0.9, '120cm': 1.2 })
      .name('신설 깊이 / Depth'),
    '깊을수록 저항↑(앞쏠림 없이 출발 어려움)·부유감↑·착지 부드럽고 스프레이↑. EN: Fresh snow depth.',
  );
  help(
    snowFolder.add(CONFIG.snow, 'powderDrag', 0, 15).name('파우더 저항 / Plow drag'),
    '깊이당 보드가 눈을 미는 감속. EN: Resistance of pushing through deep snow.',
  );
  help(
    snowFolder.add(CONFIG.snow, 'foreLeanReduce', 0, 1).name('앞쏠림 효과 / Fore effect'),
    'W(앞쏠림)가 파우더 저항을 줄이는 비율(뒤=브레이크). EN: Forward lean reduces plow.',
  );
  help(
    snowFolder.add(CONFIG.snow, 'planeSpeed', 5, 30).name('플레이닝 속도 / Planing'),
    '이 속도에 가까울수록 보드가 떠 저항↓. EN: Speed at which the board planes up.',
  );
  help(
    snowFolder.add(CONFIG.snow, 'floatGripLoss', 0, 1).name('그립 손실 / Float loss'),
    '깊은 눈에서 에지 그립이 줄어드는 정도(부유감). EN: Edge-grip loss in deep snow.',
  );
  const riderFolder = gui.addFolder('조향 / Steering');
  help(
    riderFolder.add(CONFIG.rider, 'turnRate', 0.5, 5).name('턴 속도 / Turn rate'),
    '최대 조향 각속도. 높으면 민첩하나 과회전 위험. EN: Max steer rate.',
  );
  help(
    riderFolder.add(CONFIG.rider, 'turnSpeedRef', 2, 30).name('턴 둔화 기준 / Turn falloff'),
    '이 속도 이상에서 조향이 둔해져 회전 반경↑. EN: Speed where turning widens.',
  );
  help(
    riderFolder.add(CONFIG.rider, 'minTurnSpeed', 0.5, 10).name('저속 턴 게이트 / Low-spd gate'),
    '이하 속도에선 조향 약화(제자리 스핀 방지). EN: Weakens steering at low speed.',
  );
  help(
    riderFolder.add(CONFIG.physics, 'crouchTurnFactor', 0.2, 1).name('크라우치 턴 / Tuck turn'),
    '크라우치 중 조향 배율(빨라지나 둔해짐). EN: Steering while tucked.',
  );
  help(
    riderFolder.add(CONFIG.rider, 'slopeAlign', 0, 1).name('사면 정렬 / Slope align'),
    '0=완전 수직, 1=경사에 90°. 실제 0.2~0.3. EN: Body tilt to slope (0=upright).',
  );
  help(
    riderFolder.add(CONFIG.rider, 'leanMax', 0, 1.2).name('턴 린 최대 / Lean max'),
    '턴 시 안쪽으로 기우는 최대각(0.6≈34°). EN: Max inward turn lean.',
  );
  help(
    riderFolder.add(CONFIG.rider, 'airTurnRate', 1, 8).name('공중 스핀 / Air spin'),
    '공중 좌우 회전 속도(360/720 스핀). EN: Yaw spin rate in air.',
  );
  const camFolder = gui.addFolder('카메라 / Camera');
  help(
    camFolder.add(CONFIG.camera, 'transitionTime', 0.2, 2).name('전환 시간 / Transition'),
    '카메라 모드 전환 보간 시간(초). EN: Camera mode blend time.',
  );
  help(
    camFolder.add(CONFIG.camera.third, 'distance', 3, 20).name('3인칭 거리 / 3rd dist'),
    '3인칭 후방 거리(속도 시 자동 증가). EN: Third-person follow distance.',
  );
  help(
    camFolder.add(CONFIG.camera.third, 'height', 1, 10).name('3인칭 높이 / 3rd height'),
    '3인칭 카메라 높이(m). EN: Third-person camera height.',
  );
  help(
    camFolder.add(CONFIG.camera.third, 'followLerp', 1, 12).name('추적 반응 / Follow'),
    '낮으면 묵직, 높으면 딱 붙음. EN: Camera follow responsiveness.',
  );
  help(
    camFolder.add(CONFIG.camera.third, 'airPullback', 0, 8).name('체공 풀백 / Air pullback'),
    '체공 시 추가로 빠지는 거리(에어 스케일감). EN: Extra pull-back in the air.',
  );
  help(
    camFolder.add(CONFIG.camera, 'shakeImpactScale', 0, 0.3).name('셰이크 감도 / Shake'),
    '착지 충격→화면 흔들림 비율(0=없음). EN: Landing shake amount.',
  );
  help(
    camFolder.add(CONFIG.camera, 'shakeMaxAmp', 0, 1).name('셰이크 최대 / Shake max'),
    '착지 셰이크 최대 진폭(m). EN: Max landing shake amplitude.',
  );
  camFolder.close();
  const fpFolder = gui.addFolder('1인칭 멀미설정 / POV motion');
  help(
    fpFolder.add(CONFIG.camera.first, 'motionIntensity', 0, 1).name('모션 강도 / Motion'),
    '1인칭 헤드 모션 전체 강도(멀미 시 낮추기). EN: First-person head-motion intensity.',
  );
  help(
    fpFolder.add(CONFIG.camera.first, 'bobAmp', 0, 0.1).name('바운스 / Bob'),
    '주행 중 머리 상하 흔들림 진폭. EN: Head bob amplitude.',
  );
  help(
    fpFolder.add(CONFIG.camera.first, 'rollMax', 0, 0.3).name('턴 롤 / Roll'),
    '턴 시 머리 기울기 최대각. EN: Head roll on turns.',
  );
  help(
    fpFolder.add(CONFIG.camera.first, 'lookAhead', 0, 1).name('시선 선행 / Look-ahead'),
    '시선이 진행 방향을 따라가는 비율(높으면 멀미↓). EN: Gaze leads travel direction.',
  );
  fpFolder.close();
  const fxFolder = gui.addFolder('연출 / FX');
  help(
    fxFolder.add(CONFIG.fx, 'screenIntensity', 0, 1).name('화면 효과 / Screen FX'),
    '스플래터·김서림·화이트룸·근접눈 마스터 강도. EN: Master screen-FX intensity.',
  );
  help(
    fxFolder.add(CONFIG.fx.spray, 'baseRate', 0, 400).name('스프레이 기본 / Spray'),
    '직활강 기본 파우더 방출량(속도 비례). EN: Base powder spray rate.',
  );
  help(
    fxFolder.add(CONFIG.fx.spray, 'turnRateGain', 0, 800).name('턴 스프레이 / Carve spray'),
    '턴 강도 비례 추가 스프레이(카빙 눈보라). EN: Extra spray on carves.',
  );
  help(
    fxFolder.add(CONFIG.fx.spray, 'opacity', 0, 1).name('스프레이 농도 / Spray opacity'),
    '파우더 입자 진하기. EN: Powder particle opacity.',
  );
  help(
    fxFolder.add(CONFIG.fx.cameraSnow, 'ambientDensity', 0, 1).name('강설 분위기 / Snowfall'),
    '정지 시에도 흩날리는 눈 밀도(0=맑음). EN: Ambient falling-snow density.',
  );
  help(
    fxFolder.add(CONFIG.fx.whiteroom, 'maxOpacity', 0, 1).name('화이트룸 / Whiteroom'),
    '고속 시 시야 하단 백색 베일 농도. EN: High-speed whiteout veil.',
  );
  help(
    fxFolder.add(CONFIG.fx.audio, 'master', 0, 1).name('볼륨 / Volume'),
    '전체 사운드 볼륨(0=무음). EN: Master volume.',
  );
  help(
    fxFolder.add(CONFIG.fx.music, 'enabled').name('배경음악 / BGM').onChange(() => {
      bgm.apply();
      updateMusicBtn();
    }),
    'BGM 켜기/끄기. public/audio/bgm.mp3 있으면 그 곡, 없으면 합성 앰비언트. EN: Toggle BGM.',
  );
  help(
    fxFolder.add(CONFIG.fx.music, 'volume', 0, 1).name('BGM 볼륨 / BGM Vol').onChange(() => bgm.apply()),
    '배경음악 볼륨. EN: Background music volume.',
  );
  help(
    fxFolder.add(CONFIG.fx.post, 'enabled').name('화질 향상 / Post FX'),
    '블룸+안티에일리어싱 켜기/끄기. 느리면 끄세요. EN: Bloom + SMAA post-processing.',
  );
  help(
    fxFolder
      .add(CONFIG.fx.post, 'bloomStrength', 0, 1)
      .name('블룸 세기 / Bloom')
      .onChange((v: number) => (bloomPass.strength = v)),
    '밝은 설면·태양 번짐 세기. EN: Bloom strength.',
  );
  help(
    fxFolder
      .add(CONFIG.fx.post, 'bloomThreshold', 0, 1)
      .name('블룸 임계 / Threshold')
      .onChange((v: number) => (bloomPass.threshold = v)),
    '이 밝기 이상만 번짐(높을수록 밝은 곳만). EN: Bloom luminance threshold.',
  );
  fxFolder.close();

  // ── 포스트프로세싱 (블룸 + SMAA) ────────────────────────
  // RenderPass → 블룸(밝은 설면/태양 번짐) → OutputPass(ACES 톤매핑·색공간) → SMAA(에지 AA)
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, cameraSystem.camera));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    CONFIG.fx.post.bloomStrength,
    CONFIG.fx.post.bloomRadius,
    CONFIG.fx.post.bloomThreshold,
  );
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
  const smaaPass = new SMAAPass(window.innerWidth, window.innerHeight);
  composer.addPass(smaaPass);

  // ── 리사이즈 ────────────────────────────────────────────
  window.addEventListener('resize', () => {
    cameraSystem.camera.aspect = window.innerWidth / window.innerHeight;
    cameraSystem.camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  });

  // ── 게임 루프 ───────────────────────────────────────────
  const _hn = new THREE.Vector3();
  let elapsed = 0;
  startLoop((dt) => {
    elapsed += dt;
    flags.update(elapsed);
    sky.follow(cameraSystem.camera.position);
    // 설면 스파클 깜빡임 (셰이더 컴파일 후에만 존재)
    const tShader = (terrainMesh.material as THREE.Material).userData.shader;
    if (tShader) tShader.uniforms.uTime.value = elapsed;
    // R: 새 런 시작, M: 미니맵, J: 조이스틱
    if (input.justPressed('KeyR')) startRun();
    if (input.justPressed('KeyM')) minimap.toggle();
    if (input.justPressed('KeyJ')) joystick.toggle();

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

      // 곰 추격 이벤트 (런 시작 후부터 도착지 거리 기준)
      if (run.state !== 'idle') {
        const distToFin = Math.hypot(
          rider.physics.position.x - finishPos.x,
          rider.physics.position.z - finishPos.z,
        );
        bearEvent.update(
          dt,
          rider.physics.position,
          rider.physics.heading,
          rider.physics.speed,
          distToFin,
          totalRunDist,
          terrain,
        );
      }

      // 평지 + 저속 지속 → '말 타고 갈래?' 프롬프트
      if (!rider.mounted) {
        horseCooldown = Math.max(0, horseCooldown - dt);
        terrain.getNormal(rider.physics.position.x, rider.physics.position.z, _hn);
        const flat = _hn.y > CONFIG.horse.promptSlopeCos;
        const slow = rider.physics.speed < CONFIG.horse.promptSpeed;
        horseSlowT = rider.physics.grounded && flat && slow ? horseSlowT + dt : 0;
        if (horseSlowT > CONFIG.horse.promptDelay && horseCooldown <= 0 && !horsePrompt.promptVisible) {
          horsePrompt.showPrompt();
        }
        if (horsePrompt.promptVisible && !slow) {
          horsePrompt.hidePrompt();
          horseSlowT = 0;
        }
      }
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

    if (CONFIG.fx.post.enabled) composer.render();
    else renderer.render(scene, cameraSystem.camera);
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
