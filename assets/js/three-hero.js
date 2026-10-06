/* Apertura 3D (giro 2, 05/10 notte): il marchio ufficiale come medaglia.

   Prima: una texture piatta "illuminata" da tre fasci colorati e un'ombra
   sfocata; risultato bruciato e impastato. Ora: geometria vera con un
   materiale d'oro metallico (anello a toro, disco nero lucido, scritta in
   rilievo) illuminata da un ambiente da studio disegnato al volo (softbox
   caldo in alto, kicker freddo di lato) piu' una luce chiave calda e un
   controluce oro. Niente fasci, niente fumo: il marchio resta nitido.

   La scritta viene dal PNG ufficiale (oro su nero): si ricava l'alpha dalla
   luminosita' e si scarta l'anello, che e' un solido a parte.

   three.js e' in assets/vendor (import map nell'HTML). */
import * as THREE from 'three';

const LOGO_URL = 'assets/img/logo-official.png'; // 800px: la scritta resta nitida
const GOLD = '#d4a82e';       // oro del brand book, versione per fondo scuro
const GOLD_DEEP = '#6f5612';  // lati in ombra della scritta in rilievo

/* ---------- texture disegnate al volo ---------- */

/* Ambiente equirettangolare 512x256: studio scuro e caldo, un softbox
   largo in alto a sinistra, un kicker freddo a destra, una linea d'orizzonte
   calda. E' quello che l'oro riflette. */
function makeStudioEnvironment(renderer) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const base = g.createLinearGradient(0, 0, 0, 256);
  base.addColorStop(0, '#2b241a');
  base.addColorStop(0.5, '#15110c');
  base.addColorStop(1, '#070605');
  g.fillStyle = base; g.fillRect(0, 0, 512, 256);

  g.filter = 'blur(14px)';
  // softbox caldo, alto a sinistra
  g.fillStyle = 'rgba(255, 238, 210, 0.95)';
  g.fillRect(60, 18, 190, 58);
  // secondo pannello piu' piccolo, alto a destra: secondo riflesso sull'anello
  g.fillStyle = 'rgba(255, 220, 160, 0.55)';
  g.fillRect(330, 30, 90, 40);
  // kicker freddo laterale
  g.fillStyle = 'rgba(150, 185, 230, 0.55)';
  g.fillRect(430, 96, 40, 90);
  // orizzonte caldo
  g.fillStyle = 'rgba(255, 200, 120, 0.35)';
  g.fillRect(0, 124, 512, 6);
  g.filter = 'none';

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  tex.dispose();
  pmrem.dispose();
  return env;
}

/* Mappa di rugosita' "spazzolata": righe sottili concentriche lungo l'anello.
   Sul toro la u corre intorno all'anello, quindi righe costanti per riga. */
function makeBrushedRoughness() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  for (let y = 0; y < 256; y++) {
    const v = Math.round(255 * (0.30 + (Math.sin(y * 12.9898) * 43758.5453 % 1) * 0.22));
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(0, y, 4, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 6);
  return tex;
}

/* Alone morbido dietro la medaglia (sprite): e' l'unica "luce" di scena. */
function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(212, 168, 46, 0.62)');
  grad.addColorStop(0.35, 'rgba(212, 168, 46, 0.26)');
  grad.addColorStop(1, 'rgba(212, 168, 46, 0)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* Dal PNG ufficiale (oro su nero) alla maschera della sola scritta:
   alpha dalla luminosita', anello escluso (sta oltre r = 0.72). */
function loadLetteringAlpha(url, size, onReady) {
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    const S = size;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, S, S);
    const id = g.getImageData(0, 0, S, S);
    const d = id.data;
    const half = S / 2;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4;
        const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
        const r = Math.hypot(x - half, y - half) / half;
        let a = 0;
        if (r < 0.72) {
          const t = Math.min(1, Math.max(0, (lum - 0.10) / 0.25));
          a = t * t * (3 - 2 * t);
        }
        d[i] = d[i + 1] = d[i + 2] = 255;
        d[i + 3] = Math.round(a * 255);
      }
    }
    g.putImageData(id, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 16;
    onReady(tex);
  };
  img.src = url;
}

export function initHero(canvas, opts = {}) {
  // still: movimento ridotto. Un fotogramma, ridisegnato solo se cambia la
  // misura o si scorre.
  const still = !!opts.still;
  const isMobile = window.matchMedia('(max-width: 768px)').matches;

  const scene = new THREE.Scene();
  const initialAspect = (canvas.clientWidth > 0 && canvas.clientHeight > 0)
    ? canvas.clientWidth / canvas.clientHeight : 16 / 9;
  const camera = new THREE.PerspectiveCamera(36, initialAspect, 0.1, 100);
  camera.position.set(0, 0, 9.5);

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: !isMobile, alpha: true, powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.25 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  // Sul telefono niente ambiente PMREM (costa in CPU e in compilazione):
  // bastano le luci dirette, con piu' riempimento.
  if (!isMobile) scene.environment = makeStudioEnvironment(renderer);

  /* ---------- luci ---------- */
  const key = new THREE.DirectionalLight('#ffe3bd', 2.4);   // chiave calda, alto a sinistra
  key.position.set(-3.5, 4.5, 5);
  const rim = new THREE.DirectionalLight('#ffd98a', 1.6);   // controluce oro, dietro a destra
  rim.position.set(4, 2, -3);
  const fill = new THREE.HemisphereLight('#fff3e2', '#15100a', isMobile ? 1.6 : 0.5);
  const under = new THREE.DirectionalLight('#ffc98a', 0.7);  // riempie il lato in ombra dell'anello
  under.position.set(3, -4, 4);
  scene.add(key, rim, fill, under);

  /* ---------- materiali ----------
     Sul telefono gli shader PBR (Standard/Physical) costano troppo in
     compilazione (Lighthouse: TBT +400 ms): si usa Phong, piu' leggero,
     con uno speculare oro. Sul computer, PBR con ambiente da studio. */
  const gold = isMobile
    ? new THREE.MeshPhongMaterial({ color: GOLD, specular: '#fff0b0', shininess: 60 })
    : new THREE.MeshStandardMaterial({
        color: GOLD, metalness: 1, roughness: 0.34,
        roughnessMap: makeBrushedRoughness(), envMapIntensity: 1.25,
      });
  // La scritta e' di faccia: con metalness 1 rifletterebbe solo il buio dietro
  // la camera. Un po' di diffusa e un'emissiva calda la tengono oro e leggibile.
  const goldFlat = isMobile
    ? new THREE.MeshPhongMaterial({ color: '#f2c84c', emissive: '#6a4e10', specular: '#fff6c8', shininess: 40, transparent: true, depthWrite: false })
    : new THREE.MeshStandardMaterial({
        color: '#f2c84c', metalness: 0.35, roughness: 0.5, envMapIntensity: 1.0,
        emissive: '#8a6616', emissiveIntensity: 1.0,
        transparent: true, depthWrite: false,
      });
  const goldSide = isMobile
    ? new THREE.MeshPhongMaterial({ color: GOLD_DEEP, shininess: 10, transparent: true, depthWrite: false })
    : new THREE.MeshStandardMaterial({
        color: GOLD_DEEP, metalness: 1, roughness: 0.6, envMapIntensity: 0.5,
        transparent: true, depthWrite: false,
      });
  const disc = isMobile
    ? new THREE.MeshPhongMaterial({ color: '#040304', specular: '#6a6050', shininess: 80 })
    : new THREE.MeshPhysicalMaterial({
        color: '#040304', metalness: 0.05, roughness: 0.35,
        clearcoat: 1, clearcoatRoughness: 0.3, envMapIntensity: 0.35,
      });

  /* ---------- la medaglia (raggio unitario = 1) ---------- */
  const coin = new THREE.Group();
  scene.add(coin);

  // anello: nel PNG sta a r = 0.876, spessore 0.03; qui un toro vero
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.876, 0.042, 28, 128), gold);
  coin.add(ring);

  // disco nero lucido, la faccia davanti a z = 0
  const discMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.07, 128), disc);
  discMesh.rotation.x = Math.PI / 2;
  discMesh.position.z = -0.035;
  coin.add(discMesh);

  // scritta in rilievo: quattro strati, i profondi piu' scuri
  const letterPlane = new THREE.PlaneGeometry(2, 2);
  const letterMeshes = [];
  const LAYERS = 4;
  for (let i = 0; i < LAYERS; i++) {
    const top = i === LAYERS - 1;
    const m = new THREE.Mesh(letterPlane, top ? goldFlat : goldSide);
    m.position.z = 0.004 + i * 0.006;
    m.renderOrder = 2 + i;
    m.visible = false; // finche' la maschera non e' pronta
    coin.add(m);
    letterMeshes.push(m);
  }
  loadLetteringAlpha(LOGO_URL, isMobile ? 400 : 800, (tex) => {
    goldFlat.alphaMap = tex; goldFlat.needsUpdate = true;
    goldSide.alphaMap = tex; goldSide.needsUpdate = true;
    letterMeshes.forEach(m => { m.visible = true; });
    wake();
  });

  // alone dietro
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    // depthTest acceso: lo sprite sta nel passaggio trasparente, dopo il disco;
    // senza test di profondita' si sommava sopra il disco e lo faceva verdastro.
    map: makeGlowTexture(), transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending, opacity: 1,
  }));
  glow.renderOrder = -1;
  scene.add(glow);

  /* ---------- interazione ---------- */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('mousemove', (e) => {
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = -(e.clientY / window.innerHeight) * 2 + 1;
  });
  let scrollY = 0;
  window.addEventListener('scroll', () => { scrollY = window.scrollY; wake(); }, { passive: true });

  /* ---------- impaginazione: a destra del testo se c'e' posto, sotto se no ---------- */
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
    let textRight = 0;
    let textBottom = 0;
    const parts = [];
    contentEl.querySelectorAll('.hero__eyebrow, .hero__title, .hero__sub').forEach(el => parts.push(el));
    contentEl.querySelectorAll('.hero__actions > *').forEach(el => parts.push(el));
    if (!parts.length) parts.push(contentEl);
    const range = document.createRange();
    for (const el of parts) {
      // La scatola del titolo e' larga 14ch anche quando il testo e' piu' corto:
      // si misura l'inchiostro vero con un Range.
      range.selectNodeContents(el);
      const b = range.getBoundingClientRect();
      if (b.width === 0) continue;
      textRight = Math.max(textRight, b.right - canvasBox.left);
      textBottom = Math.max(textBottom, b.bottom - canvasBox.top);
    }
    const roomRight = w - textRight;

    if (roomRight > 300) {
      const px = Math.min(roomRight * 0.86, h * 0.6);
      const cx = Math.min(textRight + roomRight * 0.55, w - px / 2 - 24);
      const cy = Math.max(h * 0.48, px / 2 + 100);
      logoPos = screenToWorld(cx, cy, w, h);
      const edge = screenToWorld(cx + px / 2, cy, w, h);
      logoSize = Math.abs(edge.x - logoPos.x);
    } else {
      const avail = Math.max(0, h - textBottom - 24);
      const px = Math.max(80, Math.min(w * 0.55, avail - 12));
      const cx = w / 2;
      const cy = textBottom + avail / 2;
      logoPos = screenToWorld(cx, cy, w, h);
      const edge = screenToWorld(cx + px / 2, cy, w, h);
      logoSize = Math.abs(edge.x - logoPos.x);
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
  const ro = new ResizeObserver(() => { resize(); wake(); });
  ro.observe(canvas);

  /* ---------- ciclo ---------- */
  const clock = new THREE.Clock();
  let rafId = 0;
  let hidden = false;

  function tick() {
    const t = still ? 0.6 : clock.getElapsedTime();
    mouse.x += (mouse.tx - mouse.x) * 0.06;
    mouse.y += (mouse.ty - mouse.y) * 0.06;

    const parallaxY = -scrollY * 0.0018;
    const cx = logoPos.x + mouse.x * 0.12;
    const cy = logoPos.y + parallaxY + mouse.y * 0.08;

    coin.position.set(cx, cy, 0);
    coin.scale.setScalar(logoSize);
    // Dondolio lento, di faccia: l'anello mostra il bordo, la scritta resta leggibile.
    coin.rotation.y = Math.sin(t * 0.24) * 0.26 + mouse.x * 0.22;
    coin.rotation.x = Math.sin(t * 0.18) * 0.08 + mouse.y * 0.10;

    // La chiave gira piano intorno alla medaglia: i riflessi camminano sull'oro.
    key.position.set(-3.5 + Math.sin(t * 0.3) * 1.6, 4.5, 5 + Math.cos(t * 0.3) * 0.8);

    glow.position.set(cx, cy - logoSize * 0.05, -1.2);
    glow.scale.set(logoSize * 3.1, logoSize * 3.1, 1);

    // Dissolvenza mentre l'apertura esce dallo schermo; fuori vista il ciclo si ferma.
    const fade = 1 - Math.min(1, Math.max(0, (scrollY - canvas.clientHeight * 0.15) / (canvas.clientHeight * 0.55)));
    if (fade <= 0.001) {
      if (!hidden) {
        hidden = true;
        canvas.style.opacity = '0';
        renderer.clear();
      }
      rafId = 0;
      return;
    }
    hidden = false;
    canvas.style.opacity = fade.toFixed(3);
    renderer.render(scene, camera);
    rafId = still ? 0 : requestAnimationFrame(tick);
  }
  function wake() { if (!rafId) rafId = requestAnimationFrame(tick); }
  rafId = requestAnimationFrame(tick);

  return {
    dispose() {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      renderer.dispose();
    },
  };
}
