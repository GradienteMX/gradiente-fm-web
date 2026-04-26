"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface Reproductor3DProps {
  // Latest FFT magnitudes from an AnalyserNode.getByteFrequencyData call.
  // Length is the analyser's frequencyBinCount (typically 1024 for fftSize=2048).
  // When null, the scene runs an idle procedural animation.
  data: Uint8Array | null;
  // Sample rate of the AudioContext that produced `data`. Used to map
  // FFT bins to logarithmic frequency space (20Hz → 20kHz). Defaults to 44100.
  sampleRate?: number;
  className?: string;
  // 'landscape' (default) — frequency axis runs horizontally.
  // 'portrait'  — camera is rolled 90°; frequency reads top-to-bottom (LOW at
  //               bottom, HIGH at top). Useful for narrow sidebars.
  orientation?: "landscape" | "portrait";
  // When false, skip OrbitControls entirely. Use for small embedded viewports
  // where drag-rotation isn't meaningful.
  interactive?: boolean;
}

// Scene resolution. Higher = denser grid, more GPU.
// Joy-division-plot proportions: fewer columns so each peak owns its own
// space, more rows so the depth direction reads as a dense comb of traces.
const COLS = 48; // log-spaced frequency columns — sparse, each peak is its own ridge
const ROWS = 80; // time history depth (waterfall slices)

// Frequency window (Hz) we display.
const F_MIN = 20;
const F_MAX = 20000;

// Vibe gradient — matches the site-wide cool→hot palette (see tailwind.config.ts
// `vibe-gradient`). Each cell's color is indexed into this gradient by a mix of
// (a) rolling track energy → "vibe" of the moment (slow signal),
// (b) per-cell magnitude → momentary intensity,
// (c) frequency position → small stratification so highs stay slightly warmer.
const VIBE_STOPS: { t: number; color: THREE.Color }[] = [
  { t: 0.0, color: new THREE.Color("#7DD3FC") }, // ice
  { t: 0.12, color: new THREE.Color("#38BDF8") }, // cold
  { t: 0.28, color: new THREE.Color("#818CF8") }, // cool
  { t: 0.42, color: new THREE.Color("#A78BFA") }, // neutral
  { t: 0.55, color: new THREE.Color("#E879F9") }, // warm
  { t: 0.7, color: new THREE.Color("#FB923C") }, // hot
  { t: 0.83, color: new THREE.Color("#F87171") }, // fire
  { t: 1.0, color: new THREE.Color("#B91C1C") }, // volcano
];

function vibeColor(t: number, out: THREE.Color): void {
  if (t <= 0) {
    out.copy(VIBE_STOPS[0].color);
    return;
  }
  if (t >= 1) {
    out.copy(VIBE_STOPS[VIBE_STOPS.length - 1].color);
    return;
  }
  for (let i = 1; i < VIBE_STOPS.length; i++) {
    const a = VIBE_STOPS[i - 1];
    const b = VIBE_STOPS[i];
    if (t <= b.t) {
      out.copy(a.color).lerp(b.color, (t - a.t) / (b.t - a.t));
      return;
    }
  }
}

export function Reproductor3D({
  data,
  sampleRate = 44100,
  className,
  orientation = "landscape",
  interactive = true,
}: Reproductor3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Stable ref to latest data so the render loop reads it without re-mounting.
  const dataRef = useRef<Uint8Array | null>(data);
  const sampleRateRef = useRef(sampleRate);
  // Defer scene setup until after first client-side mount. Avoids running
  // three.js during SSR (no document/WebGL) and any hydration dance from the
  // outer providers replacing trees.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  useEffect(() => {
    sampleRateRef.current = sampleRate;
  }, [sampleRate]);

  useEffect(() => {
    if (!mounted) return;
    const container = containerRef.current;
    if (!container) return;

    // ── Renderer ────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 1);
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    // ── Scene + camera ──────────────────────────────────────────────────────
    // Three-quarter perspective: pitched down ~38° AND yawed ~18° to the left
    // so the grid reads diagonally instead of head-on. Old-school 3D demo feel.
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 50);
    // Y/lookAt preserve the previously-rendered view (a removed "breath" loop
    // was overriding these every frame); X/Z keep the user's leftward yaw.
    camera.position.set(-2.5, 1.55, 3.25);
    // Portrait mode rolls the camera 90° via its up vector. World +X (HIGH
    // freq) ends up at the top of the rendered image; world -X (LOW freq) at
    // the bottom. Time depth and peak protrusion become horizontal. Camera is
    // also pulled further back along its sight line and panned along world +Y
    // (which becomes image-right under the rolled up vector) so the wireframe
    // sits closer to the right side of the narrow rail viewport.
    let lookAtY = 0.05;
    if (orientation === "portrait") {
      camera.up.set(1, 0, 0);
      camera.position.set(-3.25, 2.4, 4.7); // ~1.3× distance from lookAt
      lookAtY = 0.45; // pan target +Y → content shifts image-right
    }
    camera.lookAt(0, lookAtY, -1.6);

    // ── Orbit controls ──────────────────────────────────────────────────────
    // Slight, damped, range-locked. The user can nudge the angle by dragging
    // but can't lose the framing — no zoom, no pan, narrow polar+azimuth band.
    // Skipped entirely in non-interactive (sidebar) mode.
    const controlsTarget = new THREE.Vector3(0, 0.05, -1.6);
    let controls: OrbitControls | null = null;
    if (interactive) {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(controlsTarget);
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.rotateSpeed = 0.45;
      // Constrain rotation around the initial spherical position.
      const initialOffset = new THREE.Vector3().subVectors(
        camera.position,
        controlsTarget,
      );
      const initialSph = new THREE.Spherical().setFromVector3(initialOffset);
      const AZIM_RANGE = 0.44; // ~25°
      const POLAR_RANGE = 0.18; // ~10°
      controls.minAzimuthAngle = initialSph.theta - AZIM_RANGE;
      controls.maxAzimuthAngle = initialSph.theta + AZIM_RANGE;
      controls.minPolarAngle = Math.max(0.05, initialSph.phi - POLAR_RANGE);
      controls.maxPolarAngle = Math.min(
        Math.PI - 0.05,
        initialSph.phi + POLAR_RANGE,
      );
    }

    // ── Floor reference grid (the faint baseline plane in image 1) ──────────
    const floor = (() => {
      const w = 5.2;
      const d = 5;
      const stepX = w / 16;
      const stepZ = d / 16;
      const positions: number[] = [];
      for (let i = 0; i <= 16; i++) {
        const x = -w / 2 + i * stepX;
        positions.push(x, 0, 0, x, 0, -d);
      }
      for (let j = 0; j <= 16; j++) {
        const z = -j * stepZ;
        positions.push(-w / 2, 0, z, w / 2, 0, z);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      const m = new THREE.LineBasicMaterial({
        color: 0x222222,
        transparent: true,
        opacity: 0.45,
      });
      return new THREE.LineSegments(g, m);
    })();
    scene.add(floor);

    // ── Spectrogram mesh ────────────────────────────────────────────────────
    // Grid of (COLS+1) × (ROWS+1) vertices.
    // Per-vertex y is updated each frame; per-vertex color is fixed (frequency-
    // based gradient). LineSegments connect every vertex to its right and
    // forward neighbor — wireframe waterfall.

    const vertexCount = (COLS + 1) * (ROWS + 1);
    const positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);

    const GRID_W = 4.6; // wider frequency spread
    const GRID_D = 4.2; // deeper history → stronger Z perspective, less "wall of front face"
    const GRID_X0 = -GRID_W / 2;
    const GRID_Z0 = 0; // front edge sits at z=0
    const Y_SCALE = 1.3; // peak height — taller, so kicks visibly tower above the floor

    // History buffer: rows[0] is the front row (newest), rows[ROWS] is the back.
    const history: Float32Array[] = [];
    for (let r = 0; r <= ROWS; r++) history.push(new Float32Array(COLS + 1));

    // XY-positions are constant; only Y (height) and per-vertex colors update
    // each frame in the render loop below.
    for (let r = 0; r <= ROWS; r++) {
      for (let c = 0; c <= COLS; c++) {
        const idx = r * (COLS + 1) + c;
        const tx = c / COLS;
        const tz = r / ROWS;
        const x = GRID_X0 + tx * GRID_W;
        const z = GRID_Z0 - tz * GRID_D;
        positions[idx * 3 + 0] = x;
        positions[idx * 3 + 1] = 0;
        positions[idx * 3 + 2] = z;
        // Initial color: cool baseline. Real values written each frame.
        colors[idx * 3 + 0] = VIBE_STOPS[0].color.r;
        colors[idx * 3 + 1] = VIBE_STOPS[0].color.g;
        colors[idx * 3 + 2] = VIBE_STOPS[0].color.b;
      }
    }

    // Index buffer: for every cell, a horizontal segment + a forward segment.
    const indices: number[] = [];
    for (let r = 0; r <= ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i0 = r * (COLS + 1) + c;
        indices.push(i0, i0 + 1);
      }
    }
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c <= COLS; c++) {
        const i0 = r * (COLS + 1) + c;
        indices.push(i0, i0 + (COLS + 1));
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geom.setIndex(indices);

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
    });
    const mesh = new THREE.LineSegments(geom, material);
    scene.add(mesh);

    // ── Bin lookup table ────────────────────────────────────────────────────
    // Pre-compute which FFT bin (and small averaging window) each column samples.
    // Recomputed if sampleRate or data length changes.
    let binLookup: { lo: number; hi: number }[] = [];
    let lastBinCount = -1;
    let lastSampleRate = -1;

    const buildBinLookup = (binCount: number, sr: number) => {
      const binHz = sr / 2 / binCount;
      const out: { lo: number; hi: number }[] = [];
      for (let c = 0; c <= COLS; c++) {
        const tPrev = (c - 0.5) / COLS;
        const tNext = (c + 0.5) / COLS;
        const fPrev = F_MIN * Math.pow(F_MAX / F_MIN, Math.max(0, tPrev));
        const fNext = F_MIN * Math.pow(F_MAX / F_MIN, Math.min(1, tNext));
        const lo = Math.max(0, Math.floor(fPrev / binHz));
        const hi = Math.min(binCount - 1, Math.ceil(fNext / binHz));
        out.push({ lo, hi: Math.max(lo, hi) });
      }
      return out;
    };

    // ── Render loop ─────────────────────────────────────────────────────────
    const positionAttr = geom.getAttribute("position") as THREE.BufferAttribute;
    const colorAttr = geom.getAttribute("color") as THREE.BufferAttribute;
    const start = performance.now();
    let raf = 0;
    let running = true;
    let frame = 0;

    // Smoothing: keep a softened front-row buffer so transients don't clip.
    const smoothFront = new Float32Array(COLS + 1);
    // Scratch buffer for horizontal smoothing pass.
    const smoothScratch = new Float32Array(COLS + 1);
    // Rolling track energy — slow signal driving the "vibe" of the palette.
    // 0 = silent ambient → 1 = peak-time density.
    let trackEnergy = 0;
    // Persistent THREE.Color across frames to avoid GC churn.
    const tmpColor = new THREE.Color();

    // Per-band shaping table. Per-bin parameters are picked from this based
    // on the column's tx (frequency position).
    //   floor   = noise gate (subtract before renorm) → silence between hits
    //   gamma   = brightness curve on raw magnitude (lower = more "punch")
    //   attack  = 0..1, fraction of (target - prev) to add when rising
    //   release = retention factor when falling (higher = slower decay)
    //   hScale  = visual height multiplier — different bands stand at different
    //             altitudes so kicks visibly tower over hats etc.
    const BAND_LOW = {
      floor: 0.1, // raised — quiet bins fully gated, kicks pop against flat baseline
      gamma: 0.75, // less aggressive lift than 0.62 — quiet stays quiet
      attack: 1,
      release: 0.6,
      hScale: 1.4,
    };
    const BAND_MID = {
      floor: 0.03, // small gate — strips noise floor without killing sustains
      gamma: 0.92, // mostly linear
      attack: 0.85,
      release: 0.78,
      hScale: 1.0,
    };
    const BAND_HIGH = {
      floor: 0.06,
      gamma: 1.0,
      attack: 1,
      release: 0.45,
      hScale: 0.85,
    };
    const pickBand = (tx: number) =>
      tx < 0.3 ? BAND_LOW : tx < 0.65 ? BAND_MID : BAND_HIGH;

    // Cache per-column band so we don't string-compare every frame.
    const bandPerCol: (typeof BAND_LOW)[] = [];
    for (let c = 0; c <= COLS; c++) bandPerCol.push(pickBand(c / COLS));

    // Waterfall scroll rate. 1.0 = advance one row per frame (original speed).
    // 1.33 = advance ~3 rows every 4 frames → 25% slower flow front-to-back.
    // Render still runs at full rAF rate so the picture itself stays smooth.
    const FRAMES_PER_ADVANCE = 1.33;
    let advanceAccum = 0;

    const render = () => {
      if (!running) return;
      raf = requestAnimationFrame(render);

      const t = (performance.now() - start) / 1000;
      const liveData = dataRef.current;
      const sr = sampleRateRef.current;

      advanceAccum += 1;
      const shouldAdvance = advanceAccum >= FRAMES_PER_ADVANCE;
      if (shouldAdvance) advanceAccum -= FRAMES_PER_ADVANCE;

      // Rotate history only on advance frames. Off-frames keep the same front
      // row, so the picture holds steady but new history rows are written less
      // often → slower visual flow from front to back.
      if (shouldAdvance) {
        const recycled = history.pop()!;
        history.unshift(recycled);
      }
      const newFront = history[0];

      if (shouldAdvance && liveData && liveData.length > 0) {
        if (liveData.length !== lastBinCount || sr !== lastSampleRate) {
          binLookup = buildBinLookup(liveData.length, sr);
          lastBinCount = liveData.length;
          lastSampleRate = sr;
        }
        // Pass 1: per-bin gate + per-band attack/release envelopes.
        // Goal: kicks/hats read as discrete events with visible silence
        // between them; mids stay flowy and sustained.
        for (let c = 0; c <= COLS; c++) {
          const band = bandPerCol[c];
          const { lo, hi } = binLookup[c];
          let max = 0;
          for (let b = lo; b <= hi; b++) {
            const v = liveData[b];
            if (v > max) max = v;
          }
          const raw01 = max / 255;
          const gated =
            band.floor > 0
              ? Math.max(0, raw01 - band.floor) / (1 - band.floor)
              : raw01;
          const v = Math.pow(gated, band.gamma);
          const prev = smoothFront[c];
          smoothFront[c] =
            v >= prev ? prev + (v - prev) * band.attack : prev * band.release;
        }
        // No horizontal blur: with COLS=160 the natural density reads smooth,
        // and any spatial smoothing was reading as "blurry" on the noisy raw
        // FFT data once we lowered the analyser smoothingTimeConstant.
        for (let c = 0; c <= COLS; c++) newFront[c] = smoothFront[c];
      } else if (shouldAdvance) {
        // Idle procedural: two slow sines forming a soft mountain that drifts.
        for (let c = 0; c <= COLS; c++) {
          const tx = c / COLS;
          const center = (Math.sin(t * 0.18) * 0.5 + 0.5) * 0.6 + 0.2;
          const dist = Math.abs(tx - center);
          const hump = Math.exp(-(dist * dist) * 22) * 0.55;
          const ripple = (Math.sin(tx * 28 + t * 1.6) * 0.5 + 0.5) * 0.05;
          const drift = (Math.sin(tx * 6 - t * 0.8) * 0.5 + 0.5) * 0.08;
          newFront[c] = hump + ripple + drift;
        }
      }

      // Track-level rolling energy — the "vibe" signal. ~2s exponential moving
      // average of the front row's mean magnitude. Quiet ambient → ~0 (cool
      // palette); dense peak-time → ~0.5+ (warm/hot palette).
      let frontMean = 0;
      for (let c = 0; c <= COLS; c++) frontMean += newFront[c];
      frontMean /= COLS + 1;
      // 0.985 ≈ ~67-frame half-life at 60fps (~1.1s).
      trackEnergy = trackEnergy * 0.985 + frontMean * 0.015;

      // Write y-positions AND per-vertex colors from history.
      for (let r = 0; r <= ROWS; r++) {
        const row = history[r];
        const tz = r / ROWS;
        const fade = 1 - tz * 0.55; // CRT trail fade with depth.
        for (let c = 0; c <= COLS; c++) {
          const idx = r * (COLS + 1) + c;
          const m = row[c];
          // Per-band visual height — kicks tower over hats.
          positions[idx * 3 + 1] = m * Y_SCALE * bandPerCol[c].hScale;
          // Color index combines: track-level vibe, per-cell magnitude,
          // and small frequency stratification (highs slightly warmer).
          const tx = c / COLS;
          const colorIdx =
            trackEnergy * 0.55 + // slow track-level signal
            m * 0.55 + // per-cell punch
            tx * 0.18 - // freq stratification
            0.05; // baseline cool offset
          vibeColor(colorIdx > 1 ? 1 : colorIdx < 0 ? 0 : colorIdx, tmpColor);
          colors[idx * 3 + 0] = tmpColor.r * fade;
          colors[idx * 3 + 1] = tmpColor.g * fade;
          colors[idx * 3 + 2] = tmpColor.b * fade;
        }
      }
      positionAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;

      controls?.update();
      renderer.render(scene, camera);
      frame++;
    };

    // ── Resize handling ─────────────────────────────────────────────────────
    // Use offsetWidth/offsetHeight (layout box) instead of
    // getBoundingClientRect (which is affected by ancestor CSS transforms).
    // Critical inside the OverlayShell CRT boot animation, which scales the
    // overlay from a 1px line outward — getBoundingClientRect would report
    // a near-zero rect during the scale and we'd lock the WebGL buffer to
    // that tiny size; the ResizeObserver wouldn't recover because the layout
    // size never actually changed (only the visual scale did).
    const resize = () => {
      const w = Math.max(1, container.offsetWidth);
      const h = Math.max(1, container.offsetHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // Pause when tab hidden — saves cycles, no visible diff.
    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    raf = requestAnimationFrame(render);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      controls?.dispose();
      geom.dispose();
      material.dispose();
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [mounted, orientation, interactive]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%", position: "relative" }}
    />
  );
}
