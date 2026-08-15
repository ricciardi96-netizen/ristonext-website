/* Main site JS.
   Uses GSAP + ScrollTrigger (via CDN, loaded in each page's <head>) when present. */

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

/* ============ PRELOADER ============ */
(function preloader() {
  const el = document.querySelector('.preloader');
  if (!el) return;
  const num = el.querySelector('.preloader__num-val');
  const t0 = performance.now();
  const dur = 900;
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
          if (r.top < window.innerHeight) s.classList.add('in');
        });
      }, 200);
    }
  }
  requestAnimationFrame(step);
})();

/* ============ CUSTOM CURSOR ============ */
(function cursor() {
  if (window.matchMedia('(pointer: coarse)').matches) return;
  const el = document.querySelector('.cursor');
  if (!el) return;
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
    burger.addEventListener('click', () => {
      burger.classList.toggle('open');
      mobile.classList.toggle('open');
    });
    mobile.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      burger.classList.remove('open'); mobile.classList.remove('open');
    }));
  }
})();

/* ============ HERO 3D (lazy) ============ */
(async function hero() {
  const canvas = document.querySelector('.hero__canvas');
  if (!canvas) return;
  try {
    const { initHero } = await import('./three-hero.js');
    initHero(canvas);
  } catch (e) { console.warn('Hero 3D disabled:', e); }
})();

/* ============ SPLIT TEXT ============
   Wraps every word in a .word span and every char in a .char span.
   Add class="split" or class="split split-lines" to any heading.
============ */
(function splitText() {
  document.querySelectorAll('.split').forEach(el => {
    if (el.dataset.split === 'done') return;
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
    el.innerHTML = words.map((w, i) => `<span class="word" style="transition-delay:${i * 0.06}s">${w}</span>`).join(' ');
    el.dataset.split = 'done';
  });
})();

/* ============ SCROLL REVEALS + SPLIT TRIGGER ============ */
(function reveals() {
  const els = document.querySelectorAll('.reveal, .reveal--stagger, .split, .word-reveal');
  if (!('IntersectionObserver' in window) || !els.length) { els.forEach(e => e.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('in'); io.unobserve(entry.target); }
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
      window.scrollTo({ top: target.offsetTop - 60, behavior: 'smooth' });
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
  if (!gsap || !ScrollTrigger) return;
  document.querySelectorAll('.parallax-img').forEach(img => {
    gsap.to(img, {
      yPercent: -12,
      ease: 'none',
      scrollTrigger: { trigger: img, start: 'top bottom', end: 'bottom top', scrub: true }
    });
  });
})();

/* ============ PHONE MOCKUP SCROLL ============
   The phone slides change based on scroll progress within .phone-scene.
   Add data-phone-index to each .phone-scene__label.
============ */
(function phoneMockup() {
  const scene = document.querySelector('.phone-scene');
  if (!scene) return;
  const slides = scene.querySelectorAll('.phone__slide');
  const labels = scene.querySelectorAll('.phone-scene__label');
  if (!slides.length) return;

  function activate(i) {
    slides.forEach((s, idx) => s.classList.toggle('active', idx === i));
    labels.forEach((l, idx) => l.classList.toggle('active', idx === i));
  }
  activate(0);

  if (gsap && ScrollTrigger) {
    ScrollTrigger.create({
      trigger: scene,
      start: 'top 40%',
      end: 'bottom 60%',
      onUpdate(self) {
        const idx = Math.min(slides.length - 1, Math.floor(self.progress * slides.length));
        activate(idx);
      }
    });
  }
  labels.forEach((l, i) => l.addEventListener('mouseenter', () => activate(i)));
})();

/* ============ HORIZONTAL SCROLL SERVICES ============ */
(function hScroll() {
  if (!gsap || !ScrollTrigger) return;
  document.querySelectorAll('.h-scroll').forEach(section => {
    const track = section.querySelector('.h-scroll__track');
    if (!track) return;
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
