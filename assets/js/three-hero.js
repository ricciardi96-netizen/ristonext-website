/* Hero 3D scene — extruded chrome "RistoNext" 3D logo + ambient particles.
   Uses three.js from CDN (loaded as ESM import map in the HTML). */
import * as THREE from 'three';
import { FontLoader } from 'https://unpkg.com/three@0.161.0/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'https://unpkg.com/three@0.161.0/examples/jsm/geometries/TextGeometry.js';

/* Faceted chrome shader shared by the logo mesh — normals come from
   screen-space derivatives (dFdx/dFdy), not vertex normals, so any solid
   geometry (including extruded text) gets the same polished, low-poly
   liquid-metal reflections used across the site's palette. */
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
  uniform vec3 uColorWarm;
  uniform vec3 uColorGold;
  uniform vec3 uColorCool;
  uniform vec3 uColorDeep;
  varying vec3 vViewPosition;

  vec3 envColor(vec3 R, float t) {
    float h = R.y * 0.5 + 0.5;
    vec3 sky = mix(uColorDeep, uColorCool, smoothstep(0.0, 0.5, h));
    sky = mix(sky, uColorGold, smoothstep(0.45, 0.75, h));
    sky = mix(sky, uColorWarm, smoothstep(0.7, 1.0, h));

    vec3 sunDir = normalize(vec3(sin(t * 0.15) * 0.6 + 0.5, 0.55, 0.6));
    float sun = pow(max(dot(R, sunDir), 0.0), 48.0);
    float sunSoft = pow(max(dot(R, sunDir), 0.0), 6.0) * 0.3;

    vec3 coolDir = normalize(vec3(-0.6, -0.3, 0.5));
    float rim = pow(max(dot(R, coolDir), 0.0), 10.0);

    vec3 col = sky;
    col += sun * vec3(1.0, 0.92, 0.75) * 1.6;
    col += sunSoft * uColorGold * 0.8;
    col += rim * uColorCool * 0.7;
    return col;
  }

  void main() {
    vec3 fdx = dFdx(vViewPosition);
    vec3 fdy = dFdy(vViewPosition);
    vec3 N = normalize(cross(fdx, fdy));
    vec3 I = normalize(vViewPosition);

    vec3 R = reflect(I, N);
    vec3 base = envColor(R, uTime);

    float fresnel = pow(1.0 - max(dot(-I, N), 0.0), 3.0);
    base += fresnel * vec3(1.0, 0.97, 0.9) * 0.6;

    gl_FragColor = vec4(base, 1.0);
  }
`;

function sharedUniforms() {
  return {
    uTime: { value: 0 },
    uColorWarm: { value: new THREE.Color('#FF7A1A') },
    uColorGold: { value: new THREE.Color('#E8B84A') },
    // Brushed-silver mid-tone (was violet) — an elegant, brand-neutral
    // metal reflection instead of a purple tint.
    uColorCool: { value: new THREE.Color('#C4C8D2') },
    uColorDeep: { value: new THREE.Color('#0A0A10') },
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
  const logoUniforms = sharedUniforms();
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

      const textMat = new THREE.ShaderMaterial({ uniforms: logoUniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT });
      const textMesh = new THREE.Mesh(textGeo, textMat);
      logoGroup.add(textMesh);

      // Brand accent dot, echoing the pulsing bullet in front of the nav wordmark.
      const dotGeo = new THREE.SphereGeometry(0.22, 32, 32);
      const dotMat = new THREE.ShaderMaterial({ uniforms: logoUniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT });
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

  /* ============ AMBIENT SPARKLE PARTICLES ============ */
  const particleCount = isMobile ? 350 : 900;
  const particleGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const scales = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i++) {
    const r = 3.5 + Math.random() * 7;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    scales[i] = Math.random();
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));

  const particleMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uPixelRatio;
      attribute float aScale;
      varying float vAlpha;
      varying float vHue;
      void main() {
        vec3 p = position;
        float angle = uTime * 0.06 * (aScale + 0.5);
        float c = cos(angle); float s = sin(angle);
        p.xz = mat2(c, -s, s, c) * p.xz;
        p.y += sin(uTime * 0.4 + aScale * 6.28) * 0.5;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (1.0 + aScale * 2.2) * uPixelRatio * (1.0 / -mv.z) * 60.0;
        vAlpha = 0.12 + aScale * 0.45;
        vHue = aScale;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      varying float vHue;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.0, d) * vAlpha;
        vec3 warm = vec3(1.0, 0.78, 0.5);
        vec3 pale = vec3(0.96, 0.93, 0.85);
        vec3 col = mix(pale, warm, step(0.5, vHue));
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

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
    particleMat.uniforms.uTime.value = t;

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
      particleGeo.dispose();
      particleMat.dispose();
      renderer.dispose();
    }
  };
}
