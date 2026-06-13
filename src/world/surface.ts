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

// 절차적 설면 재질: 버텍스 컬러(설면/암벽) + 셰이더로 향(aspect) 색조·미세 모틀링·스파클.
// onBeforeCompile로 MeshStandardMaterial을 확장 (의존성·외부 텍스처 없음).
export function createSurfaceMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    material.userData.shader = shader;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWPos;
        varying vec3 vWNrm;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWNrm = normalize(mat3(modelMatrix) * objectNormal);`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        varying vec3 vWPos;
        varying vec3 vWNrm;
        float h13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float up = clamp(vWNrm.y, 0.0, 1.0);
          float snowMask = smoothstep(0.55, 0.82, up);
          // 향(aspect): -z=북사면(차갑게/푸르게), +z=남사면(따뜻하게)
          float a = clamp(vWNrm.z * 0.5 + 0.5, 0.0, 1.0);
          vec3 cool = vec3(0.84, 0.90, 1.0);
          vec3 warm = vec3(1.0, 0.99, 0.96);
          vec3 tint = mix(cool, warm, a);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * tint, snowMask * 0.7);
          // 바람결 미세 모틀링
          float mott = h13(floor(vWPos * 0.35));
          diffuseColor.rgb *= 1.0 - snowMask * 0.06 * mott;
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float snowMask = smoothstep(0.6, 0.85, clamp(vWNrm.y, 0.0, 1.0));
          // 설면 스파클: 고주파 셀이 임계 넘으면 반짝 (시간으로 깜빡임)
          vec3 cell = floor(vWPos * 7.0);
          float s = h13(cell + floor(uTime * 2.5));
          float spark = step(0.992, s) * snowMask;
          totalEmissiveRadiance += vec3(spark) * 1.6;
        }`,
      );
  };

  return material;
}

