// Experiencia de invitación Gradiente — port verbatim de la coreografía del
// prototipo invitacion-3d (src/main.js) a un módulo disponible para React.
//   1) sobre manila cerrado, flotando — "toca el sobre para abrir"
//   2) la solapa se abre, salen tres páginas que se abren en abanico
//   3) sale la tarjeta holográfica con el código de acceso y vuela al centro
//   4) la tarjeta queda interactiva: tilt con el puntero, clic para girar
//
// Cambios respecto a main.js (NO tocan el render ni la coreografía):
//   · refs del DOM via `ui` + `canvas` (no document.getElementById)
//   · viewport + puntero mapeados al CONTENEDOR del canvas (no a la ventana),
//     para poder embeber la experiencia en un layout
//   · ruta del emblema rebaseada a /tarjeta/assets
//   · sin watchdog (era del index.html)
//   · createExperience(...) devuelve { dispose } con teardown completo
import * as THREE from "three";
import gsap from "gsap";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { COPY, inviteRole } from "./config.js";
import { buildEnvelope, ENV_H } from "./envelope.js";
import { buildPages } from "./pages.js";
import { buildGlassCard, setupGlassEnvironment } from "./glasscard/glassCard.js";
import { loadEmblem, waitForFonts } from "./textures.js";

const EMBLEM_URL = "/tarjeta/assets/grotesco_t.png";

export function createExperience({ canvas, ui, invite }) {
  const {
    loader, loaderBar, hint, cta, ctaLink, replayBtn,
    nav, navPrev, navNext, navLabel, fallback, srMirror,
  } = ui;

  // --- teardown tracking (no existe en el prototipo: es page-level) ---
  const _listeners = [];
  const on = (t, ev, fn, opts) => { t.addEventListener(ev, fn, opts); _listeners.push([t, ev, fn, opts]); };
  let rafId = 0;
  let disposed = false;
  const host = () => canvas.parentElement;

  function showFallback() {
    loader.classList.add("done");
    fallback.style.display = "flex";
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    showFallback();
    throw new Error("WebGL no disponible");
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  // resolución COMPLETA del buffer de transmisión: el dorso de la tarjeta vive
  // detrás del vidrio (refracción/parallax), y a 0.5 ese muestreo a media
  // resolución lo veía borroso. A 1.0 el texto grabado se lee nítido sin perder
  // el efecto de profundidad. Coste: una sola tarjeta en pantalla, despreciable.
  renderer.transmissionResolutionScale = 1.0;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(new THREE.Color("#150c02"), 10.5, 17);

  const BASE_FOV = 35;
  const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.1, 60);
  camera.position.set(0, 0, 9);

  // viewport relativo al CONTENEDOR del canvas (el prototipo usaba la ventana)
  function applyViewport() {
    const el = host();
    const w = Math.max(1, el ? el.clientWidth : 1);
    const h = Math.max(1, el ? el.clientHeight : 1);
    camera.aspect = w / h;
    if (camera.aspect < 1) {
      const t = Math.tan(THREE.MathUtils.degToRad(BASE_FOV / 2)) / (camera.aspect / 0.95);
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(t));
    } else {
      camera.fov = BASE_FOV;
    }
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(w, h);
    if (composer) composer.setSize(w, h);
    if (outline) outline.setSize(w, h);
  }

  let composer, outline;
  applyViewport();

  // post: bloom restringido para el glow del vidrio/foil
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.06, 0.4, 1.0);
  composer.addPass(bloom);

  // contorno SUTIL del vidrio (sólo Card3D)
  outline = new OutlinePass(new THREE.Vector2(1, 1), scene, camera);
  outline.edgeStrength = 2.5;
  outline.edgeGlow = 0.0;
  outline.edgeThickness = 1.0;
  outline.pulsePeriod = 0;
  outline.visibleEdgeColor.set("#ffe9c4");
  outline.hiddenEdgeColor.set("#1a0f04");
  outline.selectedObjects = [];
  composer.addPass(outline);
  composer.addPass(new OutputPass());
  applyViewport(); // re-sync passes to the real container size

  // ------------------------------------------------------------------ luces
  const hemi = new THREE.HemisphereLight("#ffe9c4", "#241812", 0.5);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight("#ffe6c2", 0.16);
  scene.add(ambient);
  const key = new THREE.DirectionalLight("#fff3dd", 0.45);
  key.position.set(4, 5, 7);
  scene.add(key);
  const rim = new THREE.DirectionalLight("#7fb4ff", 0.5);
  rim.position.set(-4, -1.5, -3);
  scene.add(rim);

  RectAreaLightUniformsLib.init();
  const AIM = new THREE.Vector3(0, 0, 2.4);
  const areaL = new THREE.RectAreaLight("#ffe7cb", 3.0, 5.5, 7.5);
  areaL.position.set(-6.5, 1.6, 4.5);
  areaL.lookAt(AIM);
  scene.add(areaL);
  const areaR = new THREE.RectAreaLight("#cfe0ff", 2.2, 5.5, 7.5);
  areaR.position.set(6.5, 0.8, 4.5);
  areaR.lookAt(AIM);
  scene.add(areaR);

  // ------------------------------------------------------------------ build
  const world = new THREE.Group();
  scene.add(world);

  const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

  const state = {
    phase: "loading", // loading -> await -> opening -> card
    pointer: new THREE.Vector2(0, 0),
    reduced: reducedQuery.matches,
  };
  on(reducedQuery, "change", (e) => {
    state.reduced = e.matches;
    if (card) card.setReduced(e.matches);
  });

  // abanico final de las 5 cartas (después de la apertura)
  const FAN = [
    { x: -4.7, y: 0.15, z: -1.5, rz: 0.20, ry: 0.42 },
    { x: -2.4, y: 0.75, z: -1.45, rz: 0.10, ry: 0.22 },
    { x: 0, y: 1.05, z: -1.75, rz: 0, ry: 0 },
    { x: 2.4, y: 0.75, z: -1.45, rz: -0.10, ry: -0.22 },
    { x: 4.7, y: 0.15, z: -1.5, rz: -0.20, ry: -0.42 },
  ];
  const CARD_FINAL_Z = 2.4;
  const ENVELOPE_BACK_Z = -2.6;
  const FLAP_OPEN_X = -3.92;

  // --------------------------------------------------------------- carrusel
  // 7 piezas: la tarjeta holográfica + 5 cartas (SVG) + REGISTRO (el formulario,
  // un héroe VACÍO al que sólo se llega con el botón). REGISTRO es el último
  // índice; ‹ › recorre sólo la tarjeta + las 5 cartas.
  const PIECE_LABELS = [
    "Tarjeta de acceso",
    "Bienvenido", "Niveles", "Archivo vivo", "Calibración", "La puerta",
    "Registro",
  ];
  const REGISTRO_IDX = 6;
  const HERO_CARD = { pos: new THREE.Vector3(0, 0, CARD_FINAL_Z), rot: new THREE.Euler(0, 0, 0) };
  const HERO_PAGE = { pos: new THREE.Vector3(0, 0, 1.5), rot: new THREE.Euler(0, 0, 0) };
  // 6 huecos de fondo (anillo del carrusel para las otras 6 piezas).
  const BG_SLOTS = [
    { pos: new THREE.Vector3(-4.4, 0.1, -3.8), rot: new THREE.Euler(0, 0.42, 0.16) },
    { pos: new THREE.Vector3(-2.3, 0.55, -4.0), rot: new THREE.Euler(0, 0.24, 0.08) },
    { pos: new THREE.Vector3(0.0, 0.75, -4.2), rot: new THREE.Euler(0, 0, 0) },
    { pos: new THREE.Vector3(2.3, 0.55, -4.0), rot: new THREE.Euler(0, -0.24, -0.08) },
    { pos: new THREE.Vector3(4.4, 0.1, -3.8), rot: new THREE.Euler(0, -0.42, -0.16) },
    { pos: new THREE.Vector3(0.0, -1.5, -3.7), rot: new THREE.Euler(0, 0, 0) },
  ];

  let focused = 0;
  let cycling = false;

  const HINTS = {
    await: "toca el sobre para abrir",
    card: coarsePointer
      ? "arrastra para inclinar · toca para girar · ‹ › para cambiar"
      : "mueve el cursor · clic para girar · ‹ › o flechas para cambiar",
  };

  let envelope, pages, card, backdrop, openTl, idleTween;

  function fillAccessibleMirror() {
    srMirror.textContent = "";
    const parts = [
      ["p", `Invitación a la beta cerrada de Gradiente para ${invite.name}, rol ${inviteRole(invite).label}.`],
      ["p", `Folio ${invite.folio} · ${invite.issued}. ${COPY.tagline}`],
      ["p", "Tu código de acceso es:"],
    ];
    for (const [tag, text] of parts) {
      const el = document.createElement(tag);
      el.textContent = text;
      srMirror.appendChild(el);
    }
    const code = document.createElement("code");
    code.tabIndex = 0;
    code.textContent = invite.code;
    srMirror.appendChild(code);
    const outro = document.createElement("p");
    outro.textContent = `${COPY.needsTitle.toLowerCase()}: ${COPY.needsItems.join("; ")}. ${COPY.door.toLowerCase()}.`;
    srMirror.appendChild(outro);
  }

  async function build() {
    loaderBar.style.transform = "scaleX(0.3)";
    await waitForFonts(invite);
    if (disposed) return;
    loaderBar.style.transform = "scaleX(0.6)";
    const emblem = await loadEmblem(EMBLEM_URL);
    if (disposed) return;
    setupGlassEnvironment(renderer, scene, 1.7);
    loaderBar.style.transform = "scaleX(0.85)";

    backdrop = new THREE.Group();
    backdrop.name = "backdrop";
    world.add(backdrop);

    envelope = await buildEnvelope(invite, emblem);
    backdrop.add(envelope.group);

    pages = await buildPages();
    if (disposed) return;
    pages.forEach((p, i) => {
      p.position.set(0, -0.08, -0.02 + i * 0.02);
      backdrop.add(p);
    });

    backdrop.traverse((o) => {
      if (o.isMesh && o.material && "envMapIntensity" in o.material) o.material.envMapIntensity = 0.2;
    });

    card = await buildGlassCard({ invite, reduced: state.reduced });
    if (disposed) return;
    card.root.position.set(0, -0.06, -0.01);
    world.add(card.root);

    world.rotation.set(-0.38, 0.10, 0.03);
    world.position.y = -0.1;

    // CTA con deep link al flujo de acceso (se reemplaza por onReveal en /welcome)
    if (ctaLink) ctaLink.href = "https://gradiente.org/acceso?codigo=" + encodeURIComponent(invite.code.toLowerCase());

    fillAccessibleMirror();

    loaderBar.style.transform = "scaleX(1)";
    await new Promise((r) => setTimeout(r, 250));
    loader.classList.add("done");

    enterAwait();
  }

  // ------------------------------------------------------- fase: esperar clic
  function enterAwait() {
    state.phase = "await";
    canvas.classList.add("openable");
    canvas.setAttribute("aria-label", "Abrir el sobre de la invitación");
    hint.textContent = HINTS.await;
    hint.classList.remove("hidden");

    if (!state.reduced) {
      idleTween = gsap.to(world.position, {
        y: 0.08,
        duration: 2.6,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
    }
  }

  // --------------------------------------------------------- fase: apertura
  function buildOpenTimeline() {
    const tl = gsap.timeline({
      paused: true,
      defaults: { ease: "power3.inOut" },
      onComplete: enterCardPhase,
    });

    tl.addLabel("rise");
    tl.to(world.rotation, { x: 0, y: 0, z: 0, duration: 1.0 }, "rise");
    tl.to(world.position, { y: 0, duration: 1.0 }, "rise");

    tl.addLabel("flap", "-=0.25");
    tl.to(envelope.flap.rotation, { x: FLAP_OPEN_X, duration: 1.1, ease: "power2.inOut" }, "flap");

    const PRESENT = [
      { x: -4.2, y: 1.15, z: 0.2 },
      { x: -2.1, y: 1.7, z: 0.6 },
      { x: 0.0, y: 2.05, z: 1.1 },
      { x: 2.1, y: 1.7, z: 0.6 },
      { x: 4.2, y: 1.15, z: 0.2 },
    ];
    tl.addLabel("emerge", "-=0.3");
    pages.forEach((p, i) => {
      const at = i * 0.1;
      tl.to(p.position, { y: ENV_H / 2 + 0.55, duration: 0.5, ease: "power2.out" }, `emerge+=${at}`);
      tl.to(p.position, { x: PRESENT[i].x, y: PRESENT[i].y, z: PRESENT[i].z, duration: 0.75, ease: "power2.inOut" }, `emerge+=${at + 0.32}`);
    });
    tl.to(card.root.position, { y: ENV_H / 2 + 0.75, duration: 0.55, ease: "power2.out" }, "emerge+=0.36");
    tl.to(card.root.position, { x: 0, y: 0, z: CARD_FINAL_Z, duration: 1.05, ease: "power3.out" }, "emerge+=0.74");

    tl.addLabel("recede", "emerge+=1.3");
    tl.to(envelope.group.position, { z: ENVELOPE_BACK_Z, duration: 0.9, ease: "power2.inOut" }, "recede");

    tl.addLabel("settle", "recede+=0.4");
    pages.forEach((p, i) => {
      tl.to(p.position, { ...pick(FAN[i], "x", "y", "z"), duration: 1.0, ease: "power3.inOut" }, `settle+=${i * 0.1}`);
      tl.to(p.rotation, { z: FAN[i].rz, y: FAN[i].ry, duration: 1.0, ease: "power3.inOut" }, `settle+=${i * 0.1}`);
    });
    tl.to(backdrop.position, { z: -2.3, y: -0.45, duration: 1.15 }, "settle");

    return tl;
  }

  function pick(obj, ...keys) {
    const out = {};
    for (const k of keys) out[k] = obj[k];
    return out;
  }

  function open() {
    if (state.phase !== "await") return;
    state.phase = "opening";
    canvas.classList.remove("openable");
    hint.classList.add("hidden");
    if (idleTween) idleTween.kill();

    if (state.reduced) {
      world.rotation.set(0, 0, 0);
      world.position.set(0, 0, 0);
      envelope.flap.rotation.x = FLAP_OPEN_X;
      pages.forEach((p, i) => {
        p.position.set(FAN[i].x, FAN[i].y, FAN[i].z);
        p.rotation.set(0, FAN[i].ry, FAN[i].rz);
      });
      backdrop.position.set(0, -0.45, -2.3);
      envelope.group.position.z = ENVELOPE_BACK_Z;
      card.root.position.set(0, 0, CARD_FINAL_Z);
      enterCardPhase();
      return;
    }

    openTl = buildOpenTimeline();
    openTl.play();
  }

  // ------------------------------------------------------ fase: tarjeta viva
  function enterCardPhase() {
    state.phase = "card";
    focused = 0;
    cycling = false;
    card.setInteractive(true);
    if (outline && card) outline.selectedObjects = card.meshes;
    canvas.setAttribute("aria-label", "Girar la tarjeta de invitación");
    cta.removeAttribute("inert");
    cta.classList.add("visible");
    nav.removeAttribute("inert");
    nav.classList.add("visible");
    navLabel.textContent = PIECE_LABELS[focused];
    hint.textContent = HINTS.card;
    hint.classList.add("raised");
    hint.classList.remove("hidden");
    if (ui.onRegistroActive) ui.onRegistroActive(false);
  }

  // --- carrusel ---
  function pieceObject(i) {
    if (i === 0) return card.root;
    if (i <= 5) return pages[i - 1];
    return null; // REGISTRO (6): sin malla 3D — su "héroe" es el form del DOM
  }

  // Trae una pieza concreta al héroe (lo usa el CTA "completar registro").
  function focusPiece(i) {
    if (state.phase !== "card" || cycling || focused === i) return;
    focused = i;
    cycling = true;
    layoutCarousel(true);
    gsap.delayedCall(state.reduced ? 0.25 : 0.85, () => { cycling = false; settleRegistro(); });
  }

  function placePiece(obj, worldPose, animate) {
    const local = obj.parent.worldToLocal(worldPose.pos.clone());
    const dur = state.reduced ? 0.25 : 0.85;
    if (animate) {
      gsap.to(obj.position, { x: local.x, y: local.y, z: local.z, duration: dur, ease: "power3.inOut" });
      gsap.to(obj.rotation, { x: worldPose.rot.x, y: worldPose.rot.y, z: worldPose.rot.z, duration: dur, ease: "power3.inOut" });
    } else {
      obj.position.copy(local);
      obj.rotation.set(worldPose.rot.x, worldPose.rot.y, worldPose.rot.z);
    }
  }

  function layoutCarousel(animate) {
    const dur = state.reduced ? 0.25 : 0.85;
    const others = [];
    for (let k = 1; k < PIECE_LABELS.length; k++) others.push((focused + k) % PIECE_LABELS.length);

    if (focused === 0) {
      card.setInteractive(true);
      gsap.killTweensOf([card.tilt.rotation, card.tilt.position]);
      placePiece(card.root, HERO_CARD, animate);
      if (outline) outline.selectedObjects = card.meshes;
    } else if (focused === REGISTRO_IDX) {
      // REGISTRO: el héroe queda VACÍO (sin pieza 3D); tras el giro de las demás,
      // el formulario del DOM ocupa el centro.
      if (outline) outline.selectedObjects = [];
    } else {
      placePiece(pieceObject(focused), HERO_PAGE, animate);
      if (outline) outline.selectedObjects = [];
    }

    others.forEach((idx, slot) => {
      const obj = pieceObject(idx);
      if (!obj) return; // REGISTRO no tiene malla 3D: su hueco queda vacío
      if (idx === 0) {
        card.setInteractive(false);
        gsap.to(card.tilt.rotation, { x: 0, y: 0, z: 0, duration: dur, ease: "power3.inOut" });
        gsap.to(card.tilt.position, { x: 0, y: 0, z: 0, duration: dur, ease: "power3.inOut" });
        if (card.state.flipped) {
          gsap.to(card.flip.rotation, { y: 0, duration: dur, ease: "power3.inOut" });
          card.state.flipped = false;
        }
        placePiece(card.root, BG_SLOTS[slot], animate);
      } else {
        placePiece(obj, BG_SLOTS[slot], animate);
      }
    });

    navLabel.textContent = PIECE_LABELS[focused];
    // El form del DOM se oculta durante el giro; settleRegistro lo muestra al
    // terminar, sólo si quedó en REGISTRO (centro vacío).
    if (ui.onRegistroActive) ui.onRegistroActive(false);
  }

  // Al terminar el giro de las demás piezas: si quedamos en REGISTRO, aparece
  // el formulario real del DOM en el centro despejado.
  function settleRegistro() {
    if (ui.onRegistroActive) ui.onRegistroActive(focused === REGISTRO_IDX);
  }

  function cyclePiece(dir) {
    if (state.phase !== "card" || cycling) return;
    // ‹ › sólo recorre las 4 piezas originales; a REGISTRO se llega con el botón.
    let next = (focused - dir + PIECE_LABELS.length) % PIECE_LABELS.length;
    if (next === REGISTRO_IDX) next = (next - dir + PIECE_LABELS.length) % PIECE_LABELS.length;
    focused = next;
    cycling = true;
    layoutCarousel(true);
    gsap.delayedCall(state.reduced ? 0.25 : 0.85, () => { cycling = false; settleRegistro(); });
  }

  function replay() {
    if (state.phase !== "card") return;
    cta.classList.remove("visible");
    cta.setAttribute("inert", "");
    nav.classList.remove("visible");
    nav.setAttribute("inert", "");
    focused = 0;
    cycling = false;
    hint.classList.add("hidden");
    card.setInteractive(false);
    if (outline) outline.selectedObjects = [];
    if (openTl) {
      openTl.kill();
      openTl = null;
    }
    gsap.killTweensOf([
      world.rotation, world.position, backdrop.position,
      card.root.position, card.root.rotation, card.flip.rotation,
      card.tilt.rotation, card.tilt.position,
      envelope.flap.rotation, envelope.group.position,
      ...pages.flatMap((p) => [p.position, p.rotation]),
    ]);

    card.tilt.rotation.set(0, 0, 0);
    card.tilt.position.set(0, 0, 0);
    card.flip.rotation.set(0, 0, 0);
    card.root.rotation.set(0, 0, 0);
    card.state.flipped = false;
    card.state.flipping = false;
    card.root.position.set(0, -0.06, -0.01);
    pages.forEach((p, i) => {
      p.position.set(0, -0.08, -0.02 + i * 0.02);
      p.rotation.set(0, 0, 0);
    });
    backdrop.position.set(0, 0, 0);
    backdrop.rotation.set(0, 0, 0);
    envelope.group.position.z = 0;
    envelope.flap.rotation.x = 0;
    world.rotation.set(-0.38, 0.10, 0.03);
    world.position.y = -0.1;

    if (ui.onRegistroActive) ui.onRegistroActive(false);

    hint.classList.remove("raised");
    enterAwait();
  }

  // --------------------------------------------------------------- entrada
  const raycaster = new THREE.Raycaster();

  on(window, "pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    state.pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      ((e.clientY - r.top) / r.height) * 2 - 1,
    );
    if (card) card.setPointer(state.pointer.x, state.pointer.y);
  });

  function releasePointer(e) {
    if (e.pointerType !== "touch") return;
    state.pointer.set(0, 0);
    if (card) card.setPointer(0, 0);
  }
  on(window, "pointerup", releasePointer);
  on(window, "pointercancel", releasePointer);

  function activate(clientX, clientY) {
    if (!card) return;
    if (state.phase === "await") {
      open();
      return;
    }
    if (state.phase === "card" && focused === 0) {
      const r = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - r.left) / r.width) * 2 - 1,
        -((clientY - r.top) / r.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      if (raycaster.intersectObjects(card.meshes, false).length) card.flipCard();
    }
  }

  on(canvas, "click", (e) => activate(e.clientX, e.clientY));

  on(canvas, "keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (!card) return;
    if (state.phase === "await") open();
    else if (state.phase === "card" && focused === 0) card.flipCard();
  });

  on(window, "keydown", (e) => {
    if (state.phase !== "card") return;
    // No robar las flechas cuando se está escribiendo en un campo (REGISTRO).
    const ae = document.activeElement;
    if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable)) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); cyclePiece(-1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); cyclePiece(1); }
  });

  on(replayBtn, "click", replay);
  on(navPrev, "click", () => cyclePiece(-1));
  on(navNext, "click", () => cyclePiece(1));
  // CTA "completar registro" → trae REGISTRO al héroe (no navega).
  if (ctaLink) on(ctaLink, "click", (e) => { e.preventDefault(); focusPiece(REGISTRO_IDX); });

  on(window, "resize", applyViewport);
  const ro = new ResizeObserver(applyViewport);
  if (host()) ro.observe(host());

  // ---------------------------------------------------------------- render
  const clock = new THREE.Clock();

  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.elapsedTime;
    if (card) card.update(dt, elapsed, state.phase === "opening" || state.phase === "card");
    composer.render();
    rafId = requestAnimationFrame(tick);
  }

  build()
    .then(() => { if (!disposed) tick(); })
    .catch((err) => {
      console.error("Gradiente: fallo al construir la escena", err);
      showFallback();
    });

  // ---------------------------------------------------------------- dispose
  function dispose() {
    disposed = true;
    cancelAnimationFrame(rafId);
    ro.disconnect();
    for (const [t, ev, fn, opts] of _listeners) t.removeEventListener(ev, fn, opts);
    if (idleTween) idleTween.kill();
    if (openTl) openTl.kill();
    gsap.killTweensOf([world.position, world.rotation]);
    if (backdrop) gsap.killTweensOf([backdrop.position, backdrop.rotation]);
    if (card) gsap.killTweensOf([
      card.root.position, card.root.rotation, card.flip.rotation,
      card.tilt.rotation, card.tilt.position,
    ]);
    if (envelope) gsap.killTweensOf([envelope.flap.rotation, envelope.group.position]);
    if (pages) pages.forEach((p) => gsap.killTweensOf([p.position, p.rotation]));

    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const m = o.material;
      const ms = Array.isArray(m) ? m : m ? [m] : [];
      for (const mm of ms) {
        for (const v of Object.values(mm)) if (v && v.isTexture) v.dispose();
        if (mm.dispose) mm.dispose();
      }
    });
    if (scene.environment) scene.environment.dispose();
    bloom.dispose();
    outline.dispose();
    composer.dispose();
    renderer.dispose();
    delete window.__glass;
    delete window.__env;
  }

  return { dispose };
}
