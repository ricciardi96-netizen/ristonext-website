/* Main site JS.
   Uses GSAP + ScrollTrigger (ospitati in assets/vendor, caricati nel <head>) when present. */

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

/* 05/10 sera: chi ha chiesto al sistema meno movimento non riceve il 3D in
   moto, i blocchi dello scorrimento, la parallasse, il cursore che insegue
   ne' il preloader. Per tutti gli altri non cambia niente. */
const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ============ PRELOADER ============ */
(function preloader() {
  const el = document.querySelector('.preloader');
  if (!el) return;
  const num = el.querySelector('.preloader__num-val');
  // Giro 2: il contatore si vede solo alla prima apertura della sessione
  // (DESIGN B6) ed e' piu' corto. Dalla seconda pagina in poi, via subito.
  let seen = false;
  try { seen = sessionStorage.getItem('rn-apertura') === '1'; sessionStorage.setItem('rn-apertura', '1'); } catch (e) { /* storage bloccato: contatore breve */ }
  const t0 = performance.now();
  const dur = (RM || seen) ? 0 : 650;
  function step() {
    const p = Math.min(1, (performance.now() - t0) / dur);
    if (num) num.textContent = String(Math.floor(p * 100)).padStart(2, '0');
    if (p < 1) requestAnimationFrame(step);
    else {
      setTimeout(() => {
        el.classList.add('done');
        document.body.classList.add('loaded');
        document.querySelector('.hero')?.classList.add('loaded');
        // trigger initial splits + reveals for above-fold elements
        document.querySelectorAll('.split, .word-reveal').forEach(s => {
          const r = s.getBoundingClientRect();
          if (r.top >= window.innerHeight) return;
          s.classList.add('in');
          if (s.classList.contains('split')) {
            const chars = s.querySelectorAll('.char').length;
            setTimeout(() => s.classList.add('revealed'), 900 + chars * 12 + 150);
          }
        });
      }, (RM || seen) ? 0 : 150);
    }
  }
  requestAnimationFrame(step);
})();

/* ============ CUSTOM CURSOR ============ */
(function cursor() {
  if (RM || window.matchMedia('(pointer: coarse)').matches) return;
  const el = document.querySelector('.cursor');
  if (!el) return;
  document.documentElement.classList.add('has-cursor'); // il CSS nasconde il puntatore solo con questa classe
  let x = 0, y = 0, tx = 0, ty = 0;
  window.addEventListener('mousemove', (e) => { tx = e.clientX; ty = e.clientY; });
  (function tick() {
    x += (tx - x) * 0.22;
    y += (ty - y) * 0.22;
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    requestAnimationFrame(tick);
  })();
  const growTargets = 'a, button, .dual-card, .bento__cell, .store-badge, .h-scroll__card, .phone-scene__label';
  document.addEventListener('mouseover', (e) => { if (e.target.closest(growTargets)) el.classList.add('grow'); });
  document.addEventListener('mouseout',  (e) => { if (e.target.closest(growTargets)) el.classList.remove('grow'); });
})();

/* ============ NAV SCROLLED + MOBILE ============ */
(function nav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const burger = document.querySelector('.nav__burger');
  const mobile = document.querySelector('.nav__mobile');
  if (burger && mobile) {
    // 05/10 sera: stato letto dai lettori di schermo, Esc chiude, il focus va
    // al primo link e poi torna al bottone, la pagina sotto non scorre.
    const setOpen = (open, focusBack) => {
      burger.classList.toggle('open', open);
      mobile.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) setTimeout(() => mobile.querySelector('a')?.focus(), 60); // dopo che il pannello e' visibile
      else if (focusBack) burger.focus();
    };
    burger.addEventListener('click', () => setOpen(!mobile.classList.contains('open'), true));
    mobile.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobile.classList.contains('open')) setOpen(false, true);
    });
  }
})();

/* ============ HERO: LOGO B (2.5D, predefinito) o LOGO A (3D) ============
   Giro 2: due versioni a confronto, ?logo=b (predefinita) e ?logo=a.
   B: il PNG ufficiale tondo con anello spazzolato e riflesso in CSS,
   inclinato dal mouse qui sotto; non carica three.js (Lighthouse mobile 90).
   A: medaglia d'oro in three.js (three-hero.js); con three.js e gli shader
   la home mobile scende sotto 60. */
(async function hero() {
  const heroEl = document.querySelector('.hero');
  const canvas = document.querySelector('.hero__canvas');
  if (!heroEl || !canvas) return;
  const mode = new URLSearchParams(location.search).get('logo') === 'a' ? 'a' : 'b';
  if (mode === 'a') heroEl.classList.remove('hero--logo-b');
  if (mode === 'b') {
    heroEl.classList.add('hero--logo-b');
    const coin = heroEl.querySelector('.hero__logo-coin');
    const fig = heroEl.querySelector('.hero__logo');
    const content = heroEl.querySelector('.hero__content');
    // Sopra i 768px la medaglia sta nella colonna libera a destra del testo:
    // si misura l'inchiostro vero (Range), come fa il 3D, cosi' non copre il titolo.
    const place = () => {
      if (!fig || !content) return;
      if (window.matchMedia('(max-width: 768px)').matches) { fig.style.cssText = ''; return; }
      const hb = heroEl.getBoundingClientRect();
      const cb = content.getBoundingClientRect();
      const range = document.createRange();
      let textRight = 0;
      content.querySelectorAll('.hero__eyebrow, .hero__title, .hero__sub, .hero__actions > *').forEach(el => {
        range.selectNodeContents(el);
        const b = range.getBoundingClientRect();
        if (b.width) textRight = Math.max(textRight, b.right - cb.left);
      });
      const room = cb.width - textRight;
      const size = Math.max(160, Math.min(room * 0.86, hb.height * 0.6, 520));
      fig.style.width = size + 'px';
      fig.style.right = 'auto';
      fig.style.left = (textRight + room * 0.55 - size / 2) + 'px';
    };
    place();
    window.addEventListener('resize', place);
    document.fonts?.ready.then(place);
    setTimeout(place, 1200); // dopo il preloader e il titolo composto
    if (coin && !RM && !window.matchMedia('(pointer: coarse)').matches) {
      window.addEventListener('mousemove', (e) => {
        const x = (e.clientX / window.innerWidth) * 2 - 1;
        const y = (e.clientY / window.innerHeight) * 2 - 1;
        coin.style.setProperty('--ry', (x * 9).toFixed(2) + 'deg');
        coin.style.setProperty('--rx', (-y * 7).toFixed(2) + 'deg');
      }, { passive: true });
    }
    return;
  }
  try {
    const { initHero } = await import('./three-hero.js');
    initHero(canvas, { still: RM }); // movimento ridotto: un fotogramma fermo
  } catch (e) { console.warn('Hero 3D disabled:', e); }
})();

/* ============ SPLIT TEXT ============
   Wraps every word in a .word span and every char in a .char span.
   Add class="split" or class="split split-lines" to any heading.
============ */
(function splitText() {
  document.querySelectorAll('.split').forEach(el => {
    if (el.dataset.split === 'done') return;
    // 05/10 sera: il titolo si legge come frase. Gli spezzoni sono nascosti
    // ai lettori di schermo, che leggono l'aria-label.
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    const html = el.innerHTML;
    // preserve <em> tags: process text nodes only
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    function processNode(node) {
      const kids = Array.from(node.childNodes);
      kids.forEach(child => {
        if (child.nodeType === 3) {
          const words = child.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          words.forEach(w => {
            if (!w.trim()) { frag.appendChild(document.createTextNode(w)); return; }
            const wSpan = document.createElement('span');
            wSpan.className = 'word';
            wSpan.setAttribute('aria-hidden', 'true');
            for (const ch of w) {
              const cSpan = document.createElement('span');
              cSpan.className = 'char';
              cSpan.textContent = ch;
              wSpan.appendChild(cSpan);
            }
            frag.appendChild(wSpan);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          processNode(child);
        }
      });
    }
    processNode(tmp);
    el.innerHTML = tmp.innerHTML;
    el.dataset.split = 'done';

    // stagger animation via inline delays
    const chars = el.querySelectorAll('.char');
    chars.forEach((c, i) => {
      c.style.transition = `transform 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.012}s`;
    });
  });

  // word-reveal: wrap words for simpler word-fade
  document.querySelectorAll('.word-reveal').forEach(el => {
    if (el.dataset.split === 'done') return;
    const words = el.textContent.split(/\s+/).filter(Boolean);
    el.innerHTML = words.map((w, i) => `<span class="word" style="transition-delay:${Math.min(i * 0.06, 0.6).toFixed(2)}s">${w}</span>`).join(' ');
    el.dataset.split = 'done';
  });
})();

/* ============ SCROLL REVEALS + SPLIT TRIGGER ============ */
(function reveals() {
  const els = document.querySelectorAll('.reveal, .reveal--stagger, .split, .word-reveal');
  if (!('IntersectionObserver' in window) || !els.length) { els.forEach(e => e.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add('in');
      io.unobserve(el);
      // Drop the reveal mask once the stagger has finished so descenders
      // and italic overhangs can never be clipped afterwards.
      if (el.classList.contains('split')) {
        const chars = el.querySelectorAll('.char').length;
        setTimeout(() => el.classList.add('revealed'), 900 + chars * 12 + 150);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
  els.forEach(el => io.observe(el));
})();

/* ============ BENTO MOUSE GLOW ============ */
(function bentoGlow() {
  document.querySelectorAll('.bento__cell, .h-scroll__card, .mini-cta').forEach(cell => {
    cell.addEventListener('mousemove', (e) => {
      const r = cell.getBoundingClientRect();
      cell.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
      cell.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
    });
  });
})();

/* ============ SMOOTH ANCHORS ============ */
(function smoothAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length <= 1) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      if (window.__lenis) window.__lenis.scrollTo(target, { offset: -60 });
      else window.scrollTo({ top: target.offsetTop - 60, behavior: RM ? 'auto' : 'smooth' });
    });
  });
})();

/* ============ COUNTERS ============ */
(function counters() {
  const els = document.querySelectorAll('[data-count]');
  if (!els.length || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseFloat(el.dataset.count);
      const dur = 1500;
      const t0 = performance.now();
      function step() {
        const p = Math.min(1, (performance.now() - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Number.isInteger(target) ? Math.round(target * eased).toLocaleString('it-IT') : (target * eased).toFixed(1);
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
      io.unobserve(el);
    });
  }, { threshold: 0.4 });
  els.forEach(el => io.observe(el));
})();

/* ============ PARALLAX IMAGES ============ */
(function parallax() {
  if (RM || !gsap || !ScrollTrigger) return;
  // Giro 3: le catture "da vicino" entrano inclinate e si raddrizzano al centro dello schermo.
  document.querySelectorAll('.feat-row__media').forEach((m, i) => {
    gsap.fromTo(m, { '--ry': (i % 2 ? '14deg' : '-14deg') }, {
      '--ry': '0deg', ease: 'none',
      scrollTrigger: { trigger: m, start: 'top 95%', end: 'center 55%', scrub: true }
    });
  });
  document.querySelectorAll('.parallax-img').forEach(img => {
    gsap.to(img, {
      yPercent: -12,
      ease: 'none',
      scrollTrigger: { trigger: img, start: 'top bottom', end: 'bottom top', scrub: true }
    });
  });
})();

/* ============ PHONE MOCKUP SCROLL ============
   The phone stays pinned dead-center while the user scrolls; each ~1/7th
   of the pinned scroll distance advances the active screen (1→7), so the
   phone itself never moves — only its content and the side labels change.
============ */
(function phoneMockup() {
  const scene = document.querySelector('.phone-scene');
  const stage = scene?.querySelector('.phone-scene__stage');
  if (!scene || !stage) return;
  const slides = scene.querySelectorAll('.phone__slide');
  const labels = scene.querySelectorAll('.phone-scene__label');
  const phone = scene.querySelector('.phone');
  if (!slides.length) return;

  // Giro 2: sullo smartphone le liste sono nascoste; una didascalia sopra il
  // telefono dice la voce attiva e dieci pallini (bottoni) portano alla schermata.
  const caption = scene.querySelector('.phone-scene__caption');
  const capNum = caption?.querySelector('.phone-scene__caption__num');
  const capText = caption?.querySelector('.phone-scene__caption__text');
  const dotsWrap = scene.querySelector('.phone-scene__dots');
  const dots = [];
  if (dotsWrap) {
    labels.forEach((l, i) => {
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'phone-scene__dot';
      d.setAttribute('aria-label', l.textContent.trim());
      d.addEventListener('click', () => choose(i));
      dotsWrap.appendChild(d);
      dots.push(d);
    });
  }

  function activate(i) {
    slides.forEach((s, idx) => s.classList.toggle('active', idx === i));
    labels.forEach((l, idx) => {
      l.classList.toggle('active', idx === i);
      if (idx === i) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current');
    });
    dots.forEach((d, idx) => { if (idx === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
    const l = labels[i];
    if (l && capNum && capText) {
      capNum.textContent = l.querySelector('.phone-scene__label__num')?.textContent || '';
      capText.textContent = l.querySelector('span:last-child')?.textContent || '';
    }
  }
  activate(0);

  let st = null;
  if (gsap && ScrollTrigger && !RM) {
    const STEP_PX = 190; // scroll distance per screen while pinned
    st = ScrollTrigger.create({
      trigger: stage,
      start: 'top 100px',
      end: () => '+=' + (STEP_PX * slides.length),
      pin: true,
      pinSpacing: true,
      anticipatePin: 1,
      onUpdate(self) {
        const idx = Math.min(slides.length - 1, Math.floor(self.progress * slides.length));
        activate(idx);
        setTilt(self.progress);
      }
    });
  }
  // Giro 3: il telefono arriva inclinato in prospettiva e si raddrizza nel primo terzo dello scorrimento fissato.
  function setTilt(p) {
    if (!phone) return;
    const t = Math.max(0, 1 - p / 0.35);
    phone.style.setProperty('--tilt', `rotateY(${(-22 * t).toFixed(2)}deg) rotateX(${(7 * t).toFixed(2)}deg)`);
  }
  if (st) setTilt(0);
  // 05/10 sera: le voci sono bottoni. Tocco, clic e tastiera scelgono la
  // schermata; col telefono fissato la pagina va al punto di quella voce,
  // altrimenti lo scorrimento la riporterebbe indietro.
  const choose = (i) => {
    activate(i);
    if (st) window.scrollTo({ top: st.start + (st.end - st.start) * (i + 0.5) / slides.length, behavior: 'auto' });
  };
  labels.forEach((l, i) => {
    l.addEventListener('mouseenter', () => activate(i));
    l.addEventListener('click', () => choose(i));
    l.addEventListener('focus', () => { if (l.matches(':focus-visible')) choose(i); });
  });
})();

/* ============ HORIZONTAL SCROLL SERVICES ============
   Desktop: pin the section and scrub the track horizontally as the user
   scrolls vertically (cinematic). Mobile: that same trick demands a huge
   vertical scroll distance to traverse a narrow viewport and reads as
   "stuck" — so instead let it be a native swipeable carousel there.
============ */
(function hScroll() {
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  document.querySelectorAll('.h-scroll').forEach(section => {
    const track = section.querySelector('.h-scroll__track');
    if (!track) return;
    if (RM || isMobile || !gsap || !ScrollTrigger) {
      section.classList.add('h-scroll--native');
      return;
    }
    const scrollDist = () => track.scrollWidth - window.innerWidth + 40;
    gsap.to(track, {
      x: () => -scrollDist(),
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => '+=' + scrollDist(),
        pin: true,
        scrub: 0.5,
        invalidateOnRefresh: true
      }
    });
  });
})();

/* ============ HERO TITLE SPLIT ANIMATE ON LOAD ============ */
(function heroTitle() {
  const heroSplit = document.querySelector('.hero .split');
  if (!heroSplit) return;
  // Immediately mark as "in" after preloader fades (handled in preloader block)
})();

/* ============ GIRO 3 (05/10): LO STORE GIUSTO, IL QR, IL BOTTONE FISSO, LA MISURA ============
   Senza JS il sito resta com'era: i badge di tutti e due gli store sono nell'HTML,
   i bottoni "Scarica" portano ai badge, il QR si vede dal computer via CSS. */
(function conversione() {
  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const device = isIOS ? 'ios' : (isAndroid ? 'android' : 'desktop');
  document.documentElement.setAttribute('data-device', device);
  const page = document.body.dataset.page || 'home';
  const storeUrl = (pos) => isIOS
    ? `https://apps.apple.com/it/app/ristonext/id6762455597?ct=sito-${page}-${pos}&mt=8`
    : `https://play.google.com/store/apps/details?id=dev.a0.apps.ristonext493&referrer=${encodeURIComponent(`utm_source=sito&utm_medium=${page}&utm_content=${pos}`)}`;

  // Dal QR (ristonext.com/?da=qr): sul telefono si va dritti allo store, un passo solo.
  if (device !== 'desktop' && new URLSearchParams(location.search).get('da') === 'qr') {
    location.replace(storeUrl('qr'));
    return;
  }

  // I bottoni "Scarica" che portano ai badge (#download): sul telefono vanno dritti allo store.
  if (device !== 'desktop') {
    document.querySelectorAll('a[data-cta="store-auto"]').forEach(a => {
      a.href = storeUrl(a.dataset.pos || 'link');
      a.dataset.store = isIOS ? 'apple' : 'play';
      a.rel = 'noopener';
    });
  }
  document.querySelectorAll('.store-badge[data-cta]').forEach(a => { a.dataset.store = a.dataset.cta.replace('store-', ''); });

  // Misura dei clic: ogni [data-cta] premuto diventa un evento "rn:cta" col dettaglio
  // {cta, pos, store, page, device}. Quando ci sara' uno strumento (Cloudflare o altro)
  // basta ascoltare l'evento o definire window.rnTrack. Nessuna chiave, niente cookie.
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-cta]');
    if (!el) return;
    const detail = { cta: el.dataset.cta, pos: el.dataset.pos || '', store: el.dataset.store || '', page, device };
    document.dispatchEvent(new CustomEvent('rn:cta', { detail }));
    if (typeof window.rnTrack === 'function') window.rnTrack(detail);
  }, { passive: true });

  // Bottone fisso in basso (solo telefono via CSS). Compare quando l'apertura e' uscita
  // dallo schermo, sparisce sui badge degli store e sul piede. La X lo toglie per la sessione,
  // e chi ha gia' toccato uno store non lo rivede.
  const bar = document.querySelector('.sticky-cta');
  if (!bar) return;
  let off = false;
  try { off = sessionStorage.getItem('rn-sticky') === '1'; } catch (e) { /* storage bloccato */ }
  if (off) return;
  const hide = () => {
    bar.classList.remove('is-on');
    bar.hidden = true;
    try { sessionStorage.setItem('rn-sticky', '1'); } catch (e) { /* storage bloccato */ }
  };
  const sub = bar.querySelector('.sticky-cta__sub');
  if (sub && device !== 'desktop') sub.textContent = isIOS ? 'su App Store' : 'su Google Play';
  bar.hidden = false;
  const hero = document.querySelector('.hero, .page-hero');
  const ends = [document.querySelector('#download'), document.querySelector('.footer')].filter(Boolean);
  let heroOut = !hero, endIn = false;
  const update = () => bar.classList.toggle('is-on', heroOut && !endIn);
  if ('IntersectionObserver' in window) {
    if (hero) new IntersectionObserver((es) => {
      es.forEach(en => { heroOut = !en.isIntersecting && en.boundingClientRect.bottom <= 0; });
      update();
    }).observe(hero);
    const vis = new Map();
    const io = new IntersectionObserver((es) => {
      es.forEach(en => vis.set(en.target, en.isIntersecting));
      endIn = [...vis.values()].some(Boolean);
      update();
    });
    ends.forEach(t => io.observe(t));
  } else { heroOut = true; update(); }
  bar.querySelector('.sticky-cta__close')?.addEventListener('click', hide);
  document.addEventListener('rn:cta', (e) => { if (/^store/.test(e.detail.cta)) hide(); });
})();

/* ============ GIRO 3: LE SCHEDE SEGUONO IL MOUSE (3D leggero, solo puntatore fine) ============ */
(function tilt3d() {
  if (RM || !window.matchMedia('(pointer: fine)').matches) return;
  document.querySelectorAll('.bento__cell, .dual-card, .h-scroll__card').forEach(el => {
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--ry', (x * 7).toFixed(2) + 'deg');
      el.style.setProperty('--rx', (-y * 7).toFixed(2) + 'deg');
    });
    el.addEventListener('mouseleave', () => { el.style.removeProperty('--ry'); el.style.removeProperty('--rx'); });
  });
})();

/* ============ GIRO 3: SCORRIMENTO MORBIDO (Lenis), SOLO COL PUNTATORE FINE ============
   Sul telefono resta lo scorrimento nativo (tocco). Con movimento ridotto non parte. */
(function lenisSmooth() {
  if (RM || !gsap || !ScrollTrigger || !window.matchMedia('(pointer: fine)').matches) return;
  // Lo script si carica solo qui: il telefono non lo scarica nemmeno.
  const sc = document.createElement('script');
  sc.src = 'assets/vendor/lenis.min.js';
  sc.onload = () => {
    if (!window.Lenis) return;
    const lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
    window.__lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  };
  document.head.appendChild(sc);
})();

/* ============ GIRO 3: LA STRISCIA ACCELERA QUANDO SI SCORRE ============ */
(function marqueeVivo() {
  const track = document.querySelector('.marquee__track');
  if (!track || RM || !gsap || !ScrollTrigger) return;
  track.style.animation = 'none';
  const tween = gsap.to(track, { xPercent: -50, ease: 'none', duration: 28, repeat: -1 });
  let calm = null;
  ScrollTrigger.create({
    onUpdate(self) {
      const v = Math.min(5, 1 + Math.abs(self.getVelocity()) / 400);
      tween.timeScale(v);
      if (calm) calm.kill();
      calm = gsap.to(tween, { timeScale: 1, duration: 0.9, ease: 'power2.out' });
    }
  });
})();

/* ============ GIRO 3: LE PAROLE DEL "PERCHE'" SI ACCENDONO SCORRENDO ============ */
(function scrubWords() {
  const els = document.querySelectorAll('.scrub-words');
  if (!els.length) return;
  els.forEach(el => {
    if (el.dataset.split !== 'done') {
      const words = el.textContent.split(/\s+/).filter(Boolean);
      el.innerHTML = words.map(w => `<span class="word">${w}</span>`).join(' ');
      el.dataset.split = 'done';
    }
    if (RM || !gsap || !ScrollTrigger) { el.classList.add('in'); return; }
    gsap.to(el.querySelectorAll('.word'), {
      opacity: 1, ease: 'none', stagger: 0.08,
      scrollTrigger: { trigger: el, start: 'top 85%', end: 'bottom 45%', scrub: 0.4 }
    });
  });
})();

/* ============ GIRO 3: L'APERTURA SI ALLONTANA SCORRENDO ============ */
(function heroParallax() {
  const content = document.querySelector('.hero .hero__content');
  if (!content || RM || !gsap || !ScrollTrigger) return;
  gsap.to(content, {
    y: -90, opacity: 0.15, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
  });
})();

/* ============ GIRO 3: BOTTONI MAGNETICI (puntatore fine) ============ */
(function magnetic() {
  if (RM || !gsap || !window.matchMedia('(pointer: fine)').matches) return;
  document.querySelectorAll('.btn, .nav__cta, .store-badge, .dual-card__link').forEach(el => {
    const toX = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
    const toY = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      toX((e.clientX - (r.left + r.width / 2)) * 0.28);
      toY((e.clientY - (r.top + r.height / 2)) * 0.28);
    });
    el.addEventListener('mouseleave', () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.45)' });
    });
  });
})();

/* ============ GIRO 3: LA CATTURA SI GIRA COL MOUSE (puntatore fine) ============ */
(function mediaTilt() {
  if (RM || !window.matchMedia('(pointer: fine)').matches) return;
  document.querySelectorAll('.feat-row__media').forEach(el => {
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.setProperty('--hy', ((x - 0.5) * 16).toFixed(2) + 'deg');
      el.style.setProperty('--hx', ((0.5 - y) * 12).toFixed(2) + 'deg');
      el.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
      el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
    });
    el.addEventListener('mouseleave', () => { el.style.setProperty('--hy', '0deg'); el.style.setProperty('--hx', '0deg'); });
  });
})();
