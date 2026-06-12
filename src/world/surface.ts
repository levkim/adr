import * as THREE from 'three';
import { CONFIG } from '../config';

// 경사 기반 표면 컬러 (셋업: 설면/암벽 2단계 구분).
// 표고·향(aspect) 기반 눈질 구분은 이후 단계에서 확장.

const _snow = new THREE.Color();
const _rock = new THREE.Color();

/** 법선 경사각에 따라 설면↔암벽 버텍스 컬러를 입힌다 */
export function applySurfaceColors(geometry: THREE.BufferGeometry): void {
  const s = CONFIG.surface;
  _snow.set(s.snowColor);
  _rock.set(s.rockColor);
  // normal.y = cos(경사각)
  const snowCos = Math.cos(THREE.MathUtils.degToRad(s.snowMaxSlopeDeg));
  const rockCos = Math.cos(THREE.MathUtils.degToRad(s.rockMinSlopeDeg));

  const normals = geometry.getAttribute('normal');
  const colors = new Float32Array(normals.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < normals.count; i++) {
    const ny = normals.getY(i);
    // ny >= snowCos → 완경사(눈), ny <= rockCos → 급경사(암벽)
    const t = THREE.MathUtils.clamp((snowCos - ny) / (snowCos - rockCos), 0, 1);
    color.copy(_snow).lerp(_rock, t);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}
