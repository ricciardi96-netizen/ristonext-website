/* Hero 3D scene — frosted-glass extruded "RistoNext" 3D logo + rising steam wisps.
   Uses three.js from CDN (loaded as ESM import map in the HTML). */
import * as THREE from 'three';
import { FontLoader } from 'https://unpkg.com/three@0.161.0/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'https://unpkg.com/three@0.161.0/examples/jsm/geometries/TextGeometry.js';

/* Frosted-glass / acrylic shader for the logo mesh. Normals come from
   screen-space derivatives (dFdx/dFdy), not vertex normals — any solid
   geometry (including extruded text) gets the same treatment. The look:
   pale frosted edges (fresnel), a warm glow reading as backlit from
   within, soft translucency instead of a mirror-chrome reflection. */
const VERTEX = /* glsl */ `
  varying vec3 vViewPosition;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uGlow;
  uniform vec3 uFrost;
  varying vec3 vViewPosition;

  void main() {
    vec3 fdx = dFdx(vViewPosition);
    vec3 fdy = dFdy(vViewPosition);
    vec3 N = normalize(cross(fdx, fdy));
    vec3 I = normalize(vViewPosition);

    float facing = max(dot(-I, N), 0.0);
    float fresnel = pow(1.0 - facing, 2.4);

    // Pale, slightly cool-neutral frost brightens toward grazing edges —
    // the classic thick-glass look — while the center stays soft/translucent.
    vec3 frostColor = mix(uFrost * 0.6, vec3(1.0), fresnel);

    // Warm light reads as coming from behind the glass: strongest where
    // the surface faces the camera, with a slow breathing pulse.
    float pulse = 0.78 + 0.22 * sin(uTime * 0.55);
    vec3 glow = uGlow * facing * 0.5 * pulse;

    vec3 color = frostColor + glow;
    float alpha = mix(0.7, 0.95, fresnel);
    gl_FragColor = vec4(color, alpha);
  }
`;

function logoUniformsFactory() {
  return {
    uTime: { value: 0 },
    uGlow: { value: new THREE.Color('#FF9142') },
    uFrost: { value: new THREE.Color('#EDEFF4') },
  };
}

export function initHero(canvas) {
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x06060a, 0.08);

  const initialAspect = (canvas.clientWidth > 0 && canvas.clientHeight > 0) ? canvas.clientWidth / canvas.clientHeight : 16 / 9;
  const camera = new THREE.PerspectiveCamera(42, initialAspect, 0.1, 100);
  camera.position.set(0, 0, 9.5);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  const logoGroup = new THREE.Group();
  scene.add(logoGroup);

  /* ============ 3D LOGO (async: needs the font) ============ */
  const logoUniforms = logoUniformsFactory();
  const loader = new FontLoader();
  loader.load(
    'https://unpkg.com/three@0.161.0/examples/fonts/helvetiker_bold.typeface.json',
    (font) => {
      const textGeo = new TextGeometry('RistoNext', {
        font,
        size: 1.6,
        height: 0.32,
        curveSegments: isMobile ? 6 : 10,
        bevelEnabled: true,
        bevelThickness: 0.045,
        bevelSize: 0.03,
        bevelSegments: 3,
      });
      textGeo.computeBoundingBox();
      const bb = textGeo.boundingBox;
      const cx = (bb.max.x - bb.min.x) / 2 + bb.min.x;
      const cy = (bb.max.y - bb.min.y) / 2 + bb.min.y;
      const cz = (bb.max.z - bb.min.z) / 2 + bb.min.z;
      const rawWidth = bb.max.x - bb.min.x;
      textGeo.translate(-cx, -cy, -cz);

      const textMat = new THREE.ShaderMaterial({ uniforms: logoUniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true });
      const textMesh = new THREE.Mesh(textGeo, textMat);
      logoGroup.add(textMesh);

      // Brand accent dot, echoing the pulsing bullet in front of the nav wordmark.
      const dotGeo = new THREE.SphereGeometry(0.22, 32, 32);
      const dotMat = new THREE.ShaderMaterial({ uniforms: logoUniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(bb.min.x - cx - 0.55, bb.max.y - cy - 0.05, 0);
      logoGroup.add(dot);

      // Scale the whole wordmark to a fixed world-width regardless of font
      // metrics, so it always fits the frustum instead of running off-screen.
      const targetWidth = isMobile ? 3.0 : 3.2;
      logoGroup.scale.setScalar(targetWidth / rawWidth);
    },
    undefined,
    (err) => console.warn('Hero logo font failed to load:', err)
  );

  /* ============ RISING STEAM WISPS ============
     Sparse, soft warm-toned billboards drift slowly upward and sideways,
     fading in and out on a loop — like steam off a hot plate. Each point
     carries its own start position, duration and phase so the loop never
     feels synchronized or mechanical.
  ============ */
  const wispCount = isMobile ? 22 : 40;
  const wispGeo = new THREE.BufferGeometry();
  const basePos = new Float32Array(wispCount * 3);   // x0, z0, seed
  const timing = new Float32Array(wispCount * 2);    // duration, phase
  const sizeSeed = new Float32Array(wispCount);
  for (let i = 0; i < wispCount; i++) {
    basePos[i * 3]     = (Math.random() - 0.5) * 8.5;   // x0
    basePos[i * 3 + 1] = (Math.random() - 0.5) * 5.5 - 1.5; // z0 (reused as base z)
    basePos[i * 3 + 2] = Math.random();                  // seed
    timing[i * 2]     = 10 + Math.random() * 9;          // duration (10–19s)
    timing[i * 2 + 1] = Math.random() * 20;               // phase offset
    sizeSeed[i] = 0.5 + Math.random();
  }
  wispGeo.setAttribute('aBase', new THREE.BufferAttribute(basePos, 3));
  wispGeo.setAttribute('aTiming', new THREE.BufferAttribute(timing, 2));
  wispGeo.setAttribute('aSize', new THREE.BufferAttribute(sizeSeed, 1));
  // Dummy position attribute (required by three.js); actual placement
  // happens in the vertex shader from aBase/aTiming.
  wispGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(wispCount * 3), 3));

  const wispMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uPixelRatio;
      attribute vec3 aBase;
      attribute vec2 aTiming;
      attribute float aSize;
      varying float vAlpha;
      varying float vLife;

      void main() {
        float duration = aTiming.x;
        float life = fract((uTime + aTiming.y) / duration);

        float x = aBase.x + sin(life * 6.2831 * 1.4 + aBase.z * 12.0) * (0.5 + aBase.z * 0.8);
        float y = mix(-4.2, 4.0, life);
        float z = aBase.y;

        vec4 mv = modelViewMatrix * vec4(x, y, z, 1.0);
        gl_Position = projectionMatrix * mv;

        float sizeGrowth = mix(0.7, 2.2, life);
        gl_PointSize = aSize * sizeGrowth * uPixelRatio * (1.0 / -mv.z) * 170.0;

        vAlpha = sin(life * 3.14159) ;
        vLife = life;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      varying float vLife;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        // Wide, soft feather — a wisp, not a dot.
        float a = smoothstep(0.5, 0.0, d);
        a = pow(a, 1.6) * vAlpha * 0.4;
        vec3 cream = vec3(0.97, 0.9, 0.78);
        vec3 amber = vec3(1.0, 0.72, 0.42);
        vec3 col = mix(cream, amber, vLife * 0.6);
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const wisps = new THREE.Points(wispGeo, wispMat);
  scene.add(wisps);

  /* ============ INTERACTION ============ */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('mousemove', (e) => {
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  let scrollY = 0;
  window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });

  /* ============ RESIZE ============ */
  const BASE_Z = 9.5;
  const contentEl = document.querySelector('.hero__content');
  let logoBaseY = -2.5;

  // Converts a screen-space Y (px, from canvas top) to a world-space Y on
  // the z=0 plane under the CURRENT camera — so the logo can be anchored
  // pixel-accurately just below the real (variable-height) text block
  // instead of guessing a fixed offset that only worked at one viewport size.
  function screenYToWorldY(px, h) {
    const ndcY = -(px / h) * 2 + 1;
    const dir = new THREE.Vector3(0, ndcY, 0.5).unproject(camera).sub(camera.position).normalize();
    const dist = -camera.position.z / dir.z;
    return camera.position.y + dir.y * dist;
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0 || w > 8000 || h > 8000) return;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    // The wordmark is wide and flat — narrow (portrait) viewports need to
    // dolly back much further than a round object would, or the text
    // overflows the sides of the screen.
    camera.position.z = aspect < 1 ? BASE_Z * Math.min(2.6, 1 / aspect) : BASE_Z;
    camera.updateProjectionMatrix();

    if (contentEl) {
      const heroTop = canvas.getBoundingClientRect().top;
      const contentBottom = contentEl.getBoundingClientRect().bottom;
      const anchorPx = Math.min(contentBottom - heroTop + 36, h - 70);
      logoBaseY = screenYToWorldY(anchorPx, h);
    }
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  /* ============ RENDER LOOP ============ */
  const clock = new THREE.Clock();
  function tick() {
    const t = clock.getElapsedTime();
    mouse.x += (mouse.tx - mouse.x) * 0.06;
    mouse.y += (mouse.ty - mouse.y) * 0.06;

    logoUniforms.uTime.value = t;
    wispMat.uniforms.uTime.value = t;

    camera.position.x = mouse.x * 0.6;
    camera.position.y = mouse.y * 0.35 - scrollY * 0.0015;
    camera.lookAt(0, 0, 0);

    logoGroup.rotation.y = Math.sin(t * 0.18) * 0.22 + mouse.x * 0.25;
    logoGroup.rotation.x = Math.sin(t * 0.13) * 0.06 + mouse.y * 0.12;
    // Centered, anchored just below the real text block (see resize()) —
    // never collides with the headline/CTAs regardless of content height.
    logoGroup.position.x = 0;
    logoGroup.position.y = logoBaseY - scrollY * 0.0018;

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(tick);
  }
  let rafId = requestAnimationFrame(tick);

  return {
    dispose() {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      logoGroup.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      wispGeo.dispose();
      wispMat.dispose();
      renderer.dispose();
    }
  };
}
