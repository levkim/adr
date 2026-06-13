import * as THREE from 'three';
import { CONFIG } from '../config';

// 시간대/광원 프리셋: 하늘색·안개·태양 방향/색·반구광·강설 분위기를 한 번에 설정.
// 실제 산 사진 톤에 맞춰 블루버드(쾌청)/아침(낮은 햇빛)/강설 3종.

export interface LightPreset {
  id: string;
  name: string;
  sky: number; // 하늘/안개 색
  fogNear: number;
  fogFar: number;
  sunColor: number;
  sunIntensity: number;
  sunDir: THREE.Vector3; // 정규화된 태양 방향 (씬→태양)
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  snowfall: number; // 0~1, 강설 분위기 (시야 흩날림 + 안개)
}

export const LIGHT_PRESETS: Record<string, LightPreset> = {
  bluebird: {
    id: 'bluebird',
    name: '블루버드 (쾌청)',
    sky: 0x9ec3e6,
    fogNear: 3500,
    fogFar: 9500,
    sunColor: 0xffffff,
    sunIntensity: 2.3,
    sunDir: new THREE.Vector3(0.5, 0.78, 0.35).normalize(),
    hemiSky: 0xbcd8f5,
    hemiGround: 0xe8eef5,
    hemiIntensity: 0.8,
    snowfall: 0,
  },
  morning: {
    id: 'morning',
    name: '아침 (낮은 햇빛)',
    sky: 0xc4cad6,
    fogNear: 2600,
    fogFar: 8000,
    sunColor: 0xffd2a1, // 따뜻한 저각 햇빛
    sunIntensity: 2.0,
    sunDir: new THREE.Vector3(0.82, 0.3, 0.48).normalize(), // 낮게 → 긴 그림자
    hemiSky: 0xd7c9bf,
    hemiGround: 0xe6e2dc,
    hemiIntensity: 0.7,
    snowfall: 0,
  },
  snowfall: {
    id: 'snowfall',
    name: '강설 (흐림)',
    sky: 0xccd0d6,
    fogNear: 1200,
    fogFar: 4200, // 가시거리 짧게
    sunColor: 0xdfe6ee, // 산광, 흐릿
    sunIntensity: 1.1,
    sunDir: new THREE.Vector3(0.3, 0.85, 0.2).normalize(),
    hemiSky: 0xd2d6dc,
    hemiGround: 0xe4e8ec,
    hemiIntensity: 1.0,
    snowfall: 0.7,
  },
};

/** 프리셋을 씬/조명에 적용. 태양이 라이더를 따라다닐 오프셋을 반환 */
export function applyEnvironment(
  scene: THREE.Scene,
  sun: THREE.DirectionalLight,
  hemi: THREE.HemisphereLight,
  preset: LightPreset,
): THREE.Vector3 {
  (scene.background as THREE.Color).set(preset.sky);
  if (scene.fog) {
    (scene.fog as THREE.Fog).color.set(preset.sky);
    (scene.fog as THREE.Fog).near = preset.fogNear;
    (scene.fog as THREE.Fog).far = preset.fogFar;
  }
  sun.color.set(preset.sunColor);
  sun.intensity = preset.sunIntensity;
  hemi.color.set(preset.hemiSky);
  hemi.groundColor.set(preset.hemiGround);
  hemi.intensity = preset.hemiIntensity;

  // 강설: 시야 흩날림 분위기 (카메라 근접 파티클 기본 밀도)
  CONFIG.fx.cameraSnow.ambientDensity = preset.snowfall > 0 ? 0.35 + preset.snowfall * 0.4 : 0.15;

  // 태양 위치 오프셋 (라이더 기준)
  return preset.sunDir.clone().multiplyScalar(260);
}
