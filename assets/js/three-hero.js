/* Hero 3D scene — the official RistoNext wordmark (accent dot + "Risto" +
   "Next") staged like a product on a presentation stage: real physically-lit
   materials, three moving spotlights, and cast shadows that sweep with them.
   Uses three.js from CDN (loaded as ESM import map in the HTML). */
import * as THREE from 'three';
import { FontLoader } from 'https://unpkg.com/three@0.161.0/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'https://unpkg.com/three@0.161.0/examples/jsm/geometries/TextGeometry.js';

const BRAND_ORANGE = '#FF7A1A';
const BRAND_CREAM = '#F5F5F0';

export function initHero(canvas) {
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const scene = new THREE.Scene();

  const initialAspect = (canvas.clientWidth > 0 && canvas.clientHeight > 0) ? canvas.clientWidth / canvas.clientHeight : 16 / 9;
  const camera = new THREE.PerspectiveCamera(42, initialAspect, 0.1, 100);
  camera.position.set(0, 0, 9.5);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  /* ============ STAGE ============
     A large matte floor sits behind/below the logo purely to receive the
     spotlight pools and the logo's cast shadow. ShadowMaterial keeps it
     invisible except where light and shadow land, so the page background
     shows through everywhere else.
  ============ */
  // ShadowMaterial renders nothing except the shadows cast onto it, so the
  // page background stays visible — no hard rectangle edge against the hero.
  const stage = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 30),
    new THREE.ShadowMaterial({ opacity: 0.55 })
  );
  stage.position.z = -4.2;
  stage.receiveShadow = true;
  scene.add(stage);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 26),
    new THREE.ShadowMaterial({ opacity: 0.4 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -3.1, -1.5);
  floor.receiveShadow = true;
  scene.add(floor);

  /* ============ LIGHTING ============ */
  scene.add(new THREE.AmbientLight(0xffffff, 0.12));

  function makeSpot(color, intensity, angle) {
    const spot = new THREE.SpotLight(color, intensity, 60, angle, 0.55, 1.4);
    spot.castShadow = true;
    spot.shadow.mapSize.set(isMobile ? 512 : 1024, isMobile ? 512 : 1024);
    spot.shadow.camera.near = 1;
    spot.shadow.camera.far = 40;
    spot.shadow.bias = -0.0012;
    scene.add(spot);
    scene.add(spot.target);
    return spot;
  }

  // Key (warm brand orange), fill (cream), and a rear rim light — the
  // classic three-point stage setup, each on its own slow orbit.
  const keyLight = makeSpot(0xffa04a, 260, 0.55);
  const fillLight = makeSpot(0xfff2e0, 130, 0.7);
  const rimLight = makeSpot(0xffd9a0, 180, 0.5);

  const logoGroup = new THREE.Group();
  scene.add(logoGroup);

  /* ============ OFFICIAL WORDMARK (async: needs the font) ============
     Built to match the flat logo in the nav: a solid accent dot, "Risto"
     in cream, "Next" in brand orange.
  ============ */
  const loader = new FontLoader();
  loader.load(
    'https://unpkg.com/three@0.161.0/examples/fonts/helvetiker_bold.typeface.json',
    (font) => {
      const textOpts = {
        font,
        size: 1.6,
        height: 0.42,
        curveSegments: isMobile ? 6 : 10,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.035,
        bevelSegments: 3,
      };

      const creamMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(BRAND_CREAM), roughness: 0.38, metalness: 0.15 });
      const orangeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(BRAND_ORANGE), roughness: 0.34, metalness: 0.2 });

      const ristoGeo = new TextGeometry('Risto', textOpts);
      ristoGeo.computeBoundingBox();
      const ristoW = ristoGeo.boundingBox.max.x - ristoGeo.boundingBox.min.x;

      const nextGeo = new TextGeometry('Next', textOpts);
      nextGeo.computeBoundingBox();
      const nextW = nextGeo.boundingBox.max.x - nextGeo.boundingBox.min.x;

      const gap = 0.38;
      const dotR = 0.28;
      const dotGap = 0.42;
      const totalW = dotR * 2 + dotGap + ristoW + gap + nextW;

      // Lay the pieces out left-to-right, then recenter the whole group.
      let cursor = -totalW / 2;

      const dot = new THREE.Mesh(new THREE.SphereGeometry(dotR, 32, 32), orangeMat);
      dot.castShadow = true;
      dot.position.set(cursor + dotR, 0.45, 0);
      logoGroup.add(dot);
      cursor += dotR * 2 + dotGap;

      ristoGeo.translate(-ristoGeo.boundingBox.min.x, -ristoGeo.boundingBox.min.y, 0);
      const ristoMesh = new THREE.Mesh(ristoGeo, creamMat);
      ristoMesh.castShadow = true;
      ristoMesh.position.set(cursor, -0.55, 0);
      logoGroup.add(ristoMesh);
      cursor += ristoW + gap;

      nextGeo.translate(-nextGeo.boundingBox.min.x, -nextGeo.boundingBox.min.y, 0);
      const nextMesh = new THREE.Mesh(nextGeo, orangeMat);
      nextMesh.castShadow = true;
      nextMesh.position.set(cursor, -0.55, 0);
      logoGroup.add(nextMesh);

      const targetWidth = isMobile ? 3.0 : 4.2;
      logoGroup.scale.setScalar(targetWidth / totalW);
    },
    undefined,
    (err) => console.warn('Hero logo font failed to load:', err)
  );

  /* ============ RISING STEAM WISPS ============ */
  const wispCount = isMobile ? 18 : 32;
  const wispGeo = new THREE.BufferGeometry();
  const basePos = new Float32Array(wispCount * 3);
  const timing = new Float32Array(wispCount * 2);
  const sizeSeed = new Float32Array(wispCount);
  for (let i = 0; i < wispCount; i++) {
    basePos[i * 3]     = (Math.random() - 0.5) * 9;
    basePos[i * 3 + 1] = (Math.random() - 0.5) * 5 - 1.0;
    basePos[i * 3 + 2] = Math.random();
    timing[i * 2]     = 11 + Math.random() * 9;
    timing[i * 2 + 1] = Math.random() * 20;
    sizeSeed[i] = 0.5 + Math.random();
  }
  wispGeo.setAttribute('aBase', new THREE.BufferAttribute(basePos, 3));
  wispGeo.setAttribute('aTiming', new THREE.BufferAttribute(timing, 2));
  wispGeo.setAttribute('aSize', new THREE.BufferAttribute(sizeSeed, 1));
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
        vec4 mv = modelViewMatrix * vec4(x, y, aBase.y, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * mix(0.7, 2.2, life) * uPixelRatio * (1.0 / -mv.z) * 170.0;
        vAlpha = sin(life * 3.14159);
        vLife = life;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      varying float vLife;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = pow(smoothstep(0.5, 0.0, d), 1.6) * vAlpha * 0.32;
        vec3 cream = vec3(0.97, 0.9, 0.78);
        vec3 amber = vec3(1.0, 0.72, 0.42);
        gl_FragColor = vec4(mix(cream, amber, vLife * 0.6), a);
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
    // dolly back much further than a round object would, or it overflows.
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

    wispMat.uniforms.uTime.value = t;

    camera.position.x = mouse.x * 0.6;
    camera.position.y = mouse.y * 0.35 - scrollY * 0.0015;
    camera.lookAt(0, 0, 0);

    logoGroup.rotation.y = Math.sin(t * 0.18) * 0.2 + mouse.x * 0.22;
    logoGroup.rotation.x = Math.sin(t * 0.13) * 0.05 + mouse.y * 0.1;
    logoGroup.position.x = 0;
    logoGroup.position.y = logoBaseY - scrollY * 0.0018;

    // Spotlights sweep on independent orbits; because they are the actual
    // shadow-casting lights, the cast shadows sweep along with them.
    const ly = logoGroup.position.y;
    keyLight.position.set(Math.sin(t * 0.24) * 7.5, ly + 6.5 + Math.sin(t * 0.19) * 1.2, 7.5);
    keyLight.target.position.set(Math.sin(t * 0.24) * 1.2, ly, 0);

    fillLight.position.set(Math.cos(t * 0.17) * -8, ly + 3.4 + Math.cos(t * 0.23) * 1.0, 6.0);
    fillLight.target.position.set(Math.cos(t * 0.17) * -1.0, ly - 0.3, 0);

    rimLight.position.set(Math.sin(t * 0.31 + 2.0) * 6, ly + 5.0, -4.5);
    rimLight.target.position.set(0, ly, 0);

    keyLight.target.updateMatrixWorld();
    fillLight.target.updateMatrixWorld();
    rimLight.target.updateMatrixWorld();

    // Keep the backdrop and floor behind/below the logo as it drifts.
    stage.position.y = ly;
    floor.position.y = ly - 2.2;

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
      stage.geometry.dispose();
      stage.material.dispose();
      floor.geometry.dispose();
      floor.material.dispose();
      wispGeo.dispose();
      wispMat.dispose();
      renderer.dispose();
    }
  };
}
