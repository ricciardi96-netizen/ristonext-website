/* Hero 3D scene — the official RistoNext logo presented on a stage:
   three coloured spotlights sweep across it, the gold catches the light as
   they pass, each light throws its own soft shadow onto the backdrop, and
   volumetric beams rake down from above.

   The logo PNG is 800x800 RGB on solid black (no alpha channel), so the
   shaders derive transparency from luminance: black background drops out,
   the gold ring and lettering stay.

   Uses three.js from CDN (loaded as ESM import map in the HTML). */
import * as THREE from 'three';

const LOGO_URL = 'assets/img/logo-official.png';
const LIGHT_COUNT = 3;

/* Shared GLSL: pull alpha out of the texture's luminance, and recolour the
   mark. The logo is a concentric composition — gold ring on the outside,
   lettering in the middle — so the radial distance from the centre tells
   the two apart: the ring keeps the brand gold, the lettering goes white. */
const ALPHA_FROM_LUMA = /* glsl */ `
  float lumaAlpha(vec3 rgb) {
    float lum = dot(rgb, vec3(0.299, 0.587, 0.114));
    return smoothstep(0.05, 0.26, lum);
  }

  vec3 markColor(vec2 uv) {
    float r = distance(uv, vec2(0.5));
    float ring = smoothstep(0.33, 0.38, r);
    vec3 white = vec3(1.0, 0.99, 0.97);
    vec3 gold  = vec3(0.85, 0.69, 0.22);
    return mix(white, gold, ring);
  }
`;

export function initHero(canvas) {
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const scene = new THREE.Scene();

  const initialAspect = (canvas.clientWidth > 0 && canvas.clientHeight > 0)
    ? canvas.clientWidth / canvas.clientHeight : 16 / 9;
  const camera = new THREE.PerspectiveCamera(42, initialAspect, 0.1, 100);
  camera.position.set(0, 0, 9.5);

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: !isMobile, alpha: true, powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const logoTexture = new THREE.TextureLoader().load(LOGO_URL);
  logoTexture.colorSpace = THREE.SRGBColorSpace;
  logoTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  /* Stage lights. Positions are recomputed every frame; colours stay fixed:
     a warm key, a cool-white fill, and a gold rim to flatter the brand gold. */
  const lightPositions = [
    new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
  ];
  const lightColors = [
    new THREE.Color('#FFB067'), // warm key
    new THREE.Color('#BFD4FF'), // cool fill
    new THREE.Color('#FFD98A'), // gold rim
  ];

  const stageGroup = new THREE.Group();
  scene.add(stageGroup);

  /* ============ BACKDROP: pools of light behind the logo ============ */
  const backdropMat = new THREE.ShaderMaterial({
    uniforms: {
      uLightPos: { value: lightPositions },
      uLightColor: { value: lightColors },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uLightPos[${LIGHT_COUNT}];
      uniform vec3 uLightColor[${LIGHT_COUNT}];
      varying vec3 vWorldPos;
      void main() {
        vec3 col = vec3(0.0);
        for (int i = 0; i < ${LIGHT_COUNT}; i++) {
          float d = distance(uLightPos[i].xy, vWorldPos.xy);
          float pool = exp(-d * d * 0.055);
          col += uLightColor[i] * pool * 0.34;
        }
        float a = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(26, 18), backdropMat);
  backdrop.position.z = -2.2;
  backdrop.renderOrder = 0;
  stageGroup.add(backdrop);

  /* ============ SHADOW: a single soft drop behind the mark ============ */
  const shadowMat = new THREE.ShaderMaterial({
    uniforms: { uLogo: { value: logoTexture }, uOpacity: { value: 0.5 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uLogo;
      uniform float uOpacity;
      varying vec2 vUv;
      ${ALPHA_FROM_LUMA}
      void main() {
        // Ring of taps around each texel blurs the silhouette into a
        // diffuse shadow rather than a hard duplicate of the logo.
        float a = 0.0;
        float o = 0.016;
        a += lumaAlpha(texture2D(uLogo, vUv).rgb);
        a += lumaAlpha(texture2D(uLogo, vUv + vec2( o, 0.0)).rgb);
        a += lumaAlpha(texture2D(uLogo, vUv + vec2(-o, 0.0)).rgb);
        a += lumaAlpha(texture2D(uLogo, vUv + vec2(0.0,  o)).rgb);
        a += lumaAlpha(texture2D(uLogo, vUv + vec2(0.0, -o)).rgb);
        a += lumaAlpha(texture2D(uLogo, vUv + vec2( o,  o)).rgb);
        a += lumaAlpha(texture2D(uLogo, vUv + vec2(-o,  o)).rgb);
        a += lumaAlpha(texture2D(uLogo, vUv + vec2( o, -o)).rgb);
        a += lumaAlpha(texture2D(uLogo, vUv + vec2(-o, -o)).rgb);
        a /= 9.0;
        if (a < 0.01) discard;
        gl_FragColor = vec4(0.01, 0.008, 0.02, a * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMat);
  shadowMesh.renderOrder = 1;
  stageGroup.add(shadowMesh);

  /* ============ BEAMS: volumetric shafts raking down from above ============ */
  const beamMeshes = [];
  for (let i = 0; i < LIGHT_COUNT; i++) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: lightColors[i] } },
      vertexShader: /* glsl */ `
        varying float vY;
        void main() {
          // Cone geometry runs 0..1 along its local Y after translation.
          vY = uv.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vY;
        void main() {
          // Bright at the emitter, fading out toward the wide end.
          float fade = pow(1.0 - vY, 2.0) * 0.16;
          gl_FragColor = vec4(uColor, fade);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const geo = new THREE.ConeGeometry(1.5, 9, 24, 1, true);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 2;
    stageGroup.add(mesh);
    beamMeshes.push(mesh);
  }

  /* ============ THE LOGO ITSELF ============ */
  const logoMat = new THREE.ShaderMaterial({
    uniforms: {
      uLogo: { value: logoTexture },
      uLightPos: { value: lightPositions },
      uLightColor: { value: lightColors },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uLogo;
      uniform vec3 uLightPos[${LIGHT_COUNT}];
      uniform vec3 uLightColor[${LIGHT_COUNT}];
      varying vec2 vUv;
      varying vec3 vWorldPos;
      ${ALPHA_FROM_LUMA}
      void main() {
        vec4 tex = texture2D(uLogo, vUv);
        float a = lumaAlpha(tex.rgb);
        if (a < 0.01) discard;

        vec3 lit = vec3(0.0);
        for (int i = 0; i < ${LIGHT_COUNT}; i++) {
          float d = distance(uLightPos[i], vWorldPos);
          float atten = 1.0 / (1.0 + 0.10 * d * d);
          lit += uLightColor[i] * atten * 2.6;
        }
        // Ambient floor keeps the mark legible between sweeps.
        vec3 color = markColor(vUv) * (0.55 + lit);
        gl_FragColor = vec4(color, a);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  /* The mark is carried by a group so the extrusion stack below shares its
     transform exactly. */
  const logoGroup = new THREE.Group();
  stageGroup.add(logoGroup);

  const logoMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), logoMat);
  logoMesh.renderOrder = 4;
  logoGroup.add(logoMesh);

  /* ============ EXTRUSION: real thickness behind the face ============
     A stack of copies marching back along -Z, each darker than the last.
     Flat-on they hide behind the face; as the group sways they reveal the
     side wall of the ring and lettering, so the mark reads as a solid
     object rather than a decal. */
  const EXTRUDE_LAYERS = isMobile ? 10 : 18;
  const EXTRUDE_DEPTH = 0.075;
  const extrusionMeshes = [];
  for (let i = 1; i <= EXTRUDE_LAYERS; i++) {
    const k = i / EXTRUDE_LAYERS;            // 0 → front, 1 → deepest
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uLogo: { value: logoTexture },
        uShade: { value: 0.52 * (1 - k * 0.82) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uLogo;
        uniform float uShade;
        varying vec2 vUv;
        ${ALPHA_FROM_LUMA}
        void main() {
          float a = lumaAlpha(texture2D(uLogo, vUv).rgb);
          if (a < 0.01) discard;
          gl_FragColor = vec4(markColor(vUv) * uShade, a);
        }
      `,
      transparent: true,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.renderOrder = 3;
    mesh.userData.depth = -k * EXTRUDE_DEPTH;
    logoGroup.add(mesh);
    extrusionMeshes.push(mesh);
  }

  /* ============ INTERACTION ============ */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('mousemove', (e) => {
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  let scrollY = 0;
  window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });

  /* ============ LAYOUT ============
     The logo is anchored off the real hero text block, measured from the
     DOM: to its right when there is room, otherwise below it. */
  const BASE_Z = 9.5;
  const contentEl = document.querySelector('.hero__content');
  let logoPos = new THREE.Vector3(0, -2.4, 0);
  let logoSize = 3;

  function screenToWorld(px, py, w, h) {
    const ndc = new THREE.Vector3((px / w) * 2 - 1, -(py / h) * 2 + 1, 0.5);
    const dir = ndc.unproject(camera).sub(camera.position).normalize();
    const dist = -camera.position.z / dir.z;
    return camera.position.clone().add(dir.multiplyScalar(dist));
  }

  function layout() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!contentEl || w <= 0 || h <= 0) return;

    const canvasBox = canvas.getBoundingClientRect();
    const textBox = contentEl.getBoundingClientRect();
    const textRight = textBox.right - canvasBox.left;
    const textBottom = textBox.bottom - canvasBox.top;
    const roomRight = w - textRight;

    if (roomRight > 300) {
      // Sits in the empty column beside the copy, pushed toward the right
      // edge and high in the frame, clear of the headline.
      const px = Math.min(roomRight * 0.74, h * 0.52);
      const cx = Math.min(textRight + roomRight * 0.62, w - px / 2 - 24);
      const cy = Math.max(h * 0.34, px / 2 + 96);
      logoPos = screenToWorld(cx, cy, w, h);
      const edge = screenToWorld(cx + px / 2, cy, w, h);
      logoSize = Math.abs(edge.x - logoPos.x) * 2;
    } else {
      // Narrow viewport: drop it under the copy, centered.
      const avail = h - textBottom - 40;
      const px = Math.max(150, Math.min(w * 0.62, avail * 0.9));
      const cx = w / 2;
      const cy = textBottom + Math.min(avail / 2, px / 2 + 16);
      logoPos = screenToWorld(cx, cy, w, h);
      const edge = screenToWorld(cx + px / 2, cy, w, h);
      logoSize = Math.abs(edge.x - logoPos.x) * 2;
    }
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0 || w > 8000 || h > 8000) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = BASE_Z;
    camera.updateProjectionMatrix();
    layout();
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

    const parallaxY = -scrollY * 0.0018;
    const cx = logoPos.x + mouse.x * 0.12;
    const cy = logoPos.y + parallaxY + mouse.y * 0.08;

    // Logo: face-on, with a wider sway so the extruded side wall shows and
    // the mark reads as a solid object catching the lights.
    logoGroup.position.set(cx, cy, 0);
    logoGroup.scale.setScalar(logoSize);
    logoGroup.rotation.y = Math.sin(t * 0.22) * 0.30 + mouse.x * 0.22;
    logoGroup.rotation.x = Math.sin(t * 0.17) * 0.10 + mouse.y * 0.12;
    // Local offsets stay in group space so the stack rotates as one solid.
    logoMesh.position.set(0, 0, 0);
    for (const m of extrusionMeshes) m.position.set(0, 0, m.userData.depth);

    backdrop.position.set(cx, cy, -2.2);

    // Drive the three spotlights on independent orbits, and track their
    // combined direction so the single shadow leans away from the light.
    let sumDx = 0, sumDy = 0;
    for (let i = 0; i < LIGHT_COUNT; i++) {
      const speed = 0.24 + i * 0.11;
      const phase = (i * Math.PI * 2) / LIGHT_COUNT;
      const rx = logoSize * (0.95 + i * 0.18);
      const ry = logoSize * (0.5 + i * 0.1);
      const lx = cx + Math.cos(t * speed + phase) * rx;
      const ly = cy + Math.sin(t * speed * 1.35 + phase) * ry + logoSize * 0.25;
      lightPositions[i].set(lx, ly, 2.6);
      sumDx += cx - lx;
      sumDy += cy - ly;

      // Beam: a cone from the light, aimed at the logo.
      const beam = beamMeshes[i];
      beam.position.set(lx, ly + 4.5, 2.4);
      beam.lookAt(cx, cy, 0);
      // ConeGeometry points along +Y; rotate so it points along the look axis.
      beam.rotateX(-Math.PI / 2);
      beam.translateY(-4.5);
    }

    // One soft shadow, offset along the average light direction.
    const k = 0.055 / LIGHT_COUNT;
    shadowMesh.position.set(cx + sumDx * k, cy + sumDy * k - logoSize * 0.02, -1.9);
    shadowMesh.scale.setScalar(logoSize * 1.08);
    shadowMesh.rotation.copy(logoGroup.rotation);

    // Fade the whole stage out as the hero leaves, so the next section
    // arrives as a dissolve instead of a hard cut.
    const fade = 1 - Math.min(1, Math.max(0, (scrollY - canvas.clientHeight * 0.15) / (canvas.clientHeight * 0.55)));
    if (fade <= 0.001) {
      stageGroup.visible = false;
    } else {
      stageGroup.visible = true;
      logoMat.opacity = fade;
      canvas.style.opacity = fade.toFixed(3);
    }

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(tick);
  }
  let rafId = requestAnimationFrame(tick);

  return {
    dispose() {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      stageGroup.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      logoTexture.dispose();
      renderer.dispose();
    },
  };
}
