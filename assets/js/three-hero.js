/* Hero 3D scene — liquid chrome blob with faceted reflections + orbiting satellite blobs.
   Uses three.js from CDN (loaded as ESM import map in the HTML). */
import * as THREE from 'three';

const NOISE_GLSL = /* glsl */ `
  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
               i.z + vec4(0.0, i1.z, i2.z, 1.0))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0))
             + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0/7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
`;

const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  uniform vec2 uMouse;
  varying vec3 vViewPosition;
  varying float vDisplace;

  ${NOISE_GLSL}

  void main() {
    float t = uTime * 0.22;
    float n = snoise(position * 0.9 + vec3(t, t * 0.6, -t * 0.4));
    float n2 = snoise(position * 2.2 + vec3(-t * 0.5, t * 0.3, t * 0.7));
    float mouseInfluence = length(uMouse) * 0.25;
    float displace = (n * 0.7 + n2 * 0.25) * (uAmp + mouseInfluence);
    vDisplace = displace;
    vec3 newPos = position + normal * displace;
    vec4 mv = modelViewMatrix * vec4(newPos, 1.0);
    vViewPosition = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

/* Faceted chrome/liquid-metal shader: normals derived from screen-space
   derivatives (dFdx/dFdy) instead of interpolated vertex normals, giving
   the low-poly liquid-mercury look. Reflection is a fully procedural
   "environment" gradient — no texture/env map needed. */
const FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColorWarm;
  uniform vec3 uColorGold;
  uniform vec3 uColorCool;
  uniform vec3 uColorDeep;
  varying vec3 vViewPosition;
  varying float vDisplace;

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
    col += sun * vec3(1.0, 0.92, 0.75) * 1.5;
    col += sunSoft * uColorGold * 0.8;
    col += rim * uColorCool * 1.1;
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
    base += fresnel * vec3(1.0, 0.97, 0.9) * 0.55;

    float grad = smoothstep(-0.5, 0.5, vDisplace);
    base = mix(base * 0.85, base * 1.15, grad);

    gl_FragColor = vec4(base, 1.0);
  }
`;

function makeBlobMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    side: THREE.DoubleSide,
  });
}

function sharedUniforms() {
  return {
    uColorWarm: { value: new THREE.Color('#FF7A1A') },
    uColorGold: { value: new THREE.Color('#E8B84A') },
    uColorCool: { value: new THREE.Color('#7C3AED') },
    uColorDeep: { value: new THREE.Color('#0A0A10') },
  };
}

export function initHero(canvas) {
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x06060a, 0.1);

  const camera = new THREE.PerspectiveCamera(48, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
  camera.position.set(0, 0, 6.5);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  const colors = sharedUniforms();

  /* ============ MAIN BLOB ============ */
  const mainGeo = new THREE.IcosahedronGeometry(1.55, isMobile ? 24 : 48);
  const mainUniforms = { uTime: { value: 0 }, uAmp: { value: 0.4 }, uMouse: { value: new THREE.Vector2(0, 0) }, ...colors };
  const mainMat = makeBlobMaterial(mainUniforms);
  const mainMesh = new THREE.Mesh(mainGeo, mainMat);
  scene.add(mainMesh);

  /* ============ SATELLITE BLOBS ============ */
  const satelliteDefs = [
    { radius: 0.42, detail: isMobile ? 8 : 16, phase: 1.7, orbitR: 2.6, orbitSpeed: 0.35, orbitTilt: 0.6, amp: 0.5 },
    { radius: 0.3,  detail: isMobile ? 6 : 12, phase: 4.1, orbitR: 3.1, orbitSpeed: -0.27, orbitTilt: -0.4, amp: 0.55 },
    { radius: 0.22, detail: isMobile ? 6 : 10, phase: 2.9, orbitR: 2.1, orbitSpeed: 0.48, orbitTilt: 1.1, amp: 0.6 },
  ];
  const satellites = satelliteDefs.map(def => {
    const geo = new THREE.IcosahedronGeometry(def.radius, def.detail);
    const uniforms = { uTime: { value: 0 }, uAmp: { value: def.amp }, uMouse: { value: new THREE.Vector2(0, 0) }, ...colors };
    const mat = makeBlobMaterial(uniforms);
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    return { mesh, uniforms, def };
  });

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
        vec3 warm = vec3(1.0, 0.75, 0.45);
        vec3 cool = vec3(0.75, 0.6, 1.0);
        vec3 col = mix(warm, cool, step(0.5, vHue));
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
  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  /* ============ RENDER LOOP ============ */
  const clock = new THREE.Clock();
  function tick() {
    const t = clock.getElapsedTime();
    mouse.x += (mouse.tx - mouse.x) * 0.06;
    mouse.y += (mouse.ty - mouse.y) * 0.06;

    mainUniforms.uTime.value = t;
    mainUniforms.uMouse.value.set(mouse.x, mouse.y);
    particleMat.uniforms.uTime.value = t;

    camera.position.x = mouse.x * 0.55;
    camera.position.y = mouse.y * 0.35 - scrollY * 0.0018;
    camera.lookAt(0, 0, 0);

    mainMesh.rotation.y = t * 0.12 + mouse.x * 0.25;
    mainMesh.rotation.x = t * 0.07 + mouse.y * 0.18;
    mainMesh.position.y = -scrollY * 0.0022;

    satellites.forEach(({ mesh, uniforms, def }) => {
      const localT = t + def.phase;
      uniforms.uTime.value = localT;
      uniforms.uMouse.value.set(mouse.x, mouse.y);
      const angle = localT * def.orbitSpeed;
      const x = Math.cos(angle) * def.orbitR;
      const zBase = Math.sin(angle) * def.orbitR;
      const y = Math.sin(angle * 0.7 + def.phase) * def.orbitTilt;
      mesh.position.set(x, y - scrollY * 0.0022, zBase * 0.6 - 1.2);
      mesh.rotation.y = localT * 0.3;
      mesh.rotation.x = localT * 0.2;
    });

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(tick);
  }
  let rafId = requestAnimationFrame(tick);

  return {
    dispose() {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      mainGeo.dispose();
      mainMat.dispose();
      satellites.forEach(({ mesh }) => { mesh.geometry.dispose(); mesh.material.dispose(); });
      particleGeo.dispose();
      particleMat.dispose();
      renderer.dispose();
    }
  };
}
