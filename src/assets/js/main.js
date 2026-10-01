// LevelCast site behaviour. One module, bundled by esbuild.
//
// Motion rules (see parallax-motion-site skill):
// - transform / opacity only, so everything stays on the compositor;
// - scroll drives a playhead (scrub), it never "plays" an animation;
// - native scroll, no smooth-scroll library: the audience is on iPhone, where
//   native momentum is what people expect, and it keeps INP clean;
// - prefers-reduced-motion and the in-page switch both route through
//   motionAllowed(), and turning motion off reverts every tween to the
//   static, fully visible layout.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const html = document.documentElement;
const osReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
const motionAllowed = () => !osReduce.matches && !html.classList.contains("reduce-motion");

/* ---------------------------------------------------------------- header */
function initHeader() {
  const header = document.querySelector("[data-header]");
  if (!header) return;
  let ticking = false;
  const update = () => {
    header.classList.toggle("is-solid", window.scrollY > 40);
    ticking = false;
  };
  window.addEventListener("scroll", () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();

  // Mobile menu: close on outside click, on Escape, and after navigating.
  const menu = header.querySelector("details.menu");
  if (!menu) return;
  document.addEventListener("click", (e) => { if (menu.open && !menu.contains(e.target)) menu.open = false; });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu.open) { menu.open = false; menu.querySelector("summary").focus(); }
  });
  menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => { menu.open = false; }));
}

/* ------------------------------------------------------------ hero video */
function initHeroVideo() {
  const video = document.querySelector("[data-hero-video]");
  const btn = document.querySelector("[data-hero-pause]");
  if (!video) return;
  let userPaused = false;

  const showWhenPlaying = () => video.classList.add("is-playing");
  video.addEventListener("playing", showWhenPlaying);
  if (!video.paused && video.readyState > 2) showWhenPlaying();

  const setBtn = (paused) => {
    if (!btn) return;
    btn.setAttribute("aria-pressed", String(paused));
    btn.setAttribute("aria-label", paused ? btn.dataset.play : btn.dataset.pause);
  };

  const sync = () => {
    if (!motionAllowed() || userPaused) { video.pause(); setBtn(true); return; }
    const p = video.play();
    if (p && p.catch) p.catch(() => setBtn(true)); // low-power mode can refuse autoplay
    setBtn(false);
  };

  btn?.addEventListener("click", () => {
    userPaused = !video.paused;
    if (userPaused) { video.pause(); setBtn(true); }
    else { video.play(); setBtn(false); }
  });

  // Don't burn battery decoding a video nobody can see.
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) sync(); else video.pause();
  }, { threshold: 0.05 }).observe(video.closest("[data-hero]") || video);

  document.addEventListener("lc:motion", sync);
  sync();
}

/* ------------------------------------------------------------- parallax
   Every [data-depth] element drifts against its section while the section
   crosses the viewport. depth > 0 lags behind the scroll (further away),
   depth < 0 leads it (closer). Amplitude is a fraction of the section's
   height, halved on phones so small screens don't swim. */
function buildParallax(ctxScope) {
  const small = window.matchMedia("(max-width: 700px)").matches;
  const amp = small ? 0.55 : 1;

  document.querySelectorAll("[data-depth]").forEach((el) => {
    const depth = parseFloat(el.dataset.depth) * amp;
    const section = el.closest("section") || el.parentElement;
    const isHero = section.hasAttribute("data-hero");

    if (isHero) {
      // The hero starts at the very top, so it only travels one way: from
      // rest to `depth` of its height as it scrolls out.
      gsap.fromTo(el, { y: 0 }, {
        y: () => depth * section.offsetHeight,
        ease: "none",
        scrollTrigger: { trigger: section, start: "top top", end: "bottom top", scrub: true, invalidateOnRefresh: true },
      });
    } else {
      // Bands and phones are centred at mid-pass: -depth/2 .. +depth/2.
      const travel = () => depth * Math.min(section.offsetHeight, window.innerHeight) * 0.5;
      gsap.fromTo(el, { y: () => -travel() }, {
        y: () => travel(),
        ease: "none",
        scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: true, invalidateOnRefresh: true },
      });
    }
  });

  // The headline also fades as it leaves, so the next section owns the eye.
  const content = document.querySelector(".hero__content");
  if (content) {
    gsap.to(content, {
      opacity: 0,
      ease: "none",
      scrollTrigger: { trigger: "[data-hero]", start: "top top", end: "60% top", scrub: true },
    });
  }
  void ctxScope;
}

/* ------------------------------------------------------------ the story
   Bar heights on the icon's 512 grid. The markup ships the final state (the
   app icon), so no-JS and reduced-motion visitors see the finished mark.
   JS rewinds the bars to "before" and lets the scroll play them forward. */
const ICON = [166, 232, 196, 252, 188, 227, 170];
const GHOST = { 1: 300, 3: 340, 5: 250 };
const LOUD_QUIET = [70, 330, 56, 360, 66, 320, 74]; // host loud (2, 4, 6), guest quiet
const TURNED_UP = [104, 452, 86, 476, 98, 440, 108]; // you turn it up; the host clips

function buildStory() {
  const story = document.querySelector("[data-story]");
  if (!story) return;
  const q = (s) => story.querySelectorAll(s);
  const bars = q(".meter .bar");
  const peaks = q(".meter .peak");
  const ghosts = q(".meter .ghost");
  const tile = story.querySelector(".meter__tile");
  const glow = story.querySelector(".story__glow");
  const scale = (arr, i) => arr[i] / ICON[i];
  const host = (i) => i % 2 === 1;

  const tl = gsap.timeline({
    defaults: { ease: "power2.inOut" },
    scrollTrigger: { trigger: story, start: "top top", end: "bottom bottom", scrub: true },
  });

  // State 0, applied before the timeline exists so the tweens below record
  // it as their starting point: host loud with red peaks, guest barely there.
  const o = { transformOrigin: "50% 50%" };
  gsap.set(bars, { ...o, scaleY: (i) => scale(LOUD_QUIET, i) });
  gsap.set(peaks, { ...o, scaleY: (i) => scale(LOUD_QUIET, i), opacity: (i) => (host(i) ? 0.85 : 0) });
  gsap.set(ghosts, { ...o, scaleY: (i) => TURNED_UP[+ghosts[i].dataset.i] / GHOST[+ghosts[i].dataset.i], opacity: 0 });
  gsap.set(tile, { ...o, opacity: 0, scale: 0.86 });
  gsap.set(glow, { opacity: 0.25 });

  // Step 2: you turn it up for the guest; the host now clips hard.
  tl.to(bars, { scaleY: (i) => scale(TURNED_UP, i), duration: 0.7 }, 0.9)
    .to(peaks, { scaleY: (i) => scale(TURNED_UP, i), opacity: (i) => (host(i) ? 1 : 0.35), duration: 0.7 }, 0.9)
    .to(glow, { opacity: 0.7, duration: 0.7 }, 0.9);

  // Step 3: levelling. Bars settle to the icon, red drains away, the old
  // heights linger as ghosts exactly like on the app icon.
  tl.to(bars, { scaleY: 1, duration: 0.8, stagger: 0.04 }, 2.2)
    .to(peaks, { scaleY: 1, opacity: 0, duration: 0.6, stagger: 0.04 }, 2.2)
    .to(ghosts, { opacity: 0.3, duration: 0.25 }, 2.25)
    .to(ghosts, { scaleY: 1, duration: 0.8 }, 2.45)
    .to(glow, { opacity: 0.35, duration: 0.6 }, 2.4);

  // Step 4: the tile arrives behind the bars and it *is* the app icon.
  tl.to(tile, { opacity: 1, scale: 1, duration: 0.6, ease: "power3.out" }, 3.3)
    .to(glow, { opacity: 0.9, duration: 0.6 }, 3.3)
    .to({}, { duration: 0.1 }, 4);
}

/* ------------------------------------------------------- motion lifecycle */
let ctx = null;
function setupMotion() {
  ctx?.revert();
  ctx = null;
  if (!motionAllowed()) { ScrollTrigger.refresh(); return; }
  ctx = gsap.context(() => {
    buildParallax();
    buildStory();
  });
  // Fonts change line breaks and section heights; measure again after them.
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}

function initMotionToggle() {
  const btn = document.querySelector("[data-motion-toggle]");
  const label = () => {
    if (!btn) return;
    const off = html.classList.contains("reduce-motion");
    btn.setAttribute("aria-pressed", String(off));
    btn.textContent = off ? btn.dataset.off : btn.dataset.on;
  };
  label();
  btn?.addEventListener("click", () => {
    const off = !html.classList.contains("reduce-motion");
    html.classList.toggle("reduce-motion", off);
    try { off ? localStorage.setItem("lc-motion", "reduce") : localStorage.removeItem("lc-motion"); } catch (e) { /* private mode */ }
    label();
    setupMotion();
    document.dispatchEvent(new Event("lc:motion"));
  });
  osReduce.addEventListener?.("change", () => { setupMotion(); document.dispatchEvent(new Event("lc:motion")); });
}

/* ------------------------------------------------------------ A/B player
   Both versions play at once and the switch only flips which one is muted,
   so the swap is instant and lands on exactly the same syllable. */
function initAB() {
  const root = document.querySelector("[data-ab]");
  if (!root) return;
  const a = {
    before: root.querySelector('[data-ab-src="before"]'),
    after: root.querySelector('[data-ab-src="after"]'),
  };
  const ui = root.querySelector(".ab__ui");
  const playBtn = root.querySelector("[data-ab-play]");
  const picks = root.querySelectorAll("[data-ab-pick]");
  const seek = root.querySelector("[data-ab-seek]");
  const time = root.querySelector("[data-ab-time]");
  const head = root.querySelector("[data-ab-head]");
  const wave = root.querySelector(".ab__wave");
  const bins = [...root.querySelectorAll(".ab__wave i")];
  let active = "before";
  let raf = 0;

  root.classList.add("is-enhanced");
  ui.hidden = false;
  Object.values(a).forEach((el) => { el.preload = "auto"; el.controls = false; });

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const dur = () => a.before.duration || 60;

  const paint = () => {
    const t = a[active].currentTime;
    const p = Math.min(1, t / dur());
    const n = Math.floor(p * bins.length);
    bins.forEach((b, i) => b.classList.toggle("on", i < n));
    head.style.setProperty("--x", `${p * wave.clientWidth}px`);
    seek.value = String(t);
    time.textContent = `${fmt(t)} / ${fmt(dur())}`;
  };
  const loop = () => {
    // Keep the muted twin locked to the audible one.
    const other = active === "before" ? a.after : a.before;
    if (Math.abs(other.currentTime - a[active].currentTime) > 0.08) other.currentTime = a[active].currentTime;
    paint();
    raf = requestAnimationFrame(loop);
  };

  const setPlaying = (on) => {
    root.classList.toggle("is-playing", on);
    playBtn.setAttribute("aria-label", on ? playBtn.dataset.pause : playBtn.dataset.play);
    cancelAnimationFrame(raf);
    if (on) raf = requestAnimationFrame(loop); else paint();
  };

  const choose = (which) => {
    active = which;
    a.before.muted = which !== "before";
    a.after.muted = which !== "after";
    root.classList.toggle("is-after", which === "after");
    picks.forEach((b) => b.setAttribute("aria-checked", String(b.dataset.abPick === which)));
  };
  choose("before");

  playBtn.addEventListener("click", async () => {
    if (root.classList.contains("is-playing")) {
      a.before.pause(); a.after.pause(); setPlaying(false); return;
    }
    a.after.currentTime = a.before.currentTime;
    try { await Promise.all([a.before.play(), a.after.play()]); setPlaying(true); }
    catch (e) { setPlaying(false); }
  });
  picks.forEach((b) => b.addEventListener("click", () => choose(b.dataset.abPick)));
  // Arrow keys move between the two radio buttons, as a radio group should.
  root.querySelector(".ab__switch").addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const next = active === "before" ? "after" : "before";
    choose(next);
    root.querySelector(`[data-ab-pick="${next}"]`).focus();
  });
  seek.addEventListener("input", () => {
    const t = parseFloat(seek.value);
    a.before.currentTime = t; a.after.currentTime = t; paint();
  });
  a.before.addEventListener("loadedmetadata", () => { seek.max = String(dur()); paint(); });
  a.before.addEventListener("ended", () => {
    a.after.pause(); a.before.currentTime = 0; a.after.currentTime = 0; setPlaying(false);
  });
  window.addEventListener("resize", paint, { passive: true });
  paint();
}

/* ------------------------------------------------------------------ boot */
initHeader();
initHeroVideo();
initMotionToggle();
initAB();
setupMotion();
