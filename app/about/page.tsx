'use client'

// /about — QUÉ ES GRADIENTE. Replaces the prior BrandPageShell version.
//
// This page is the invitation HTML from `Gradiente-ops/deliverables/INVITACION_v2.html`
// inlined as a single client component. We keep that file as the canonical
// invitation deliverable (sent per-recipient with a code) and copy its shape
// here for the public "about" surface. Two intentional divergences from the
// invitation:
//   1. The welcome-section "Para activar tu cuenta…" block + the access-code
//      input + ENTRAR button are stripped — they only make sense for a fresh
//      invitee, not a visitor who navigated here from the header.
//   2. The internal .topbar is de-stickied so it doesn't compete with the
//      site's own sticky <Navigation>; the chrome is preserved on first paint
//      but scrolls away after the first viewport.
//
// Everything else (fonts, color tokens, scanline overlay, glitch, phosphor-
// tape vibe fader, TOC intersection observer, manifesto password gate) is
// preserved verbatim. CSS is scoped under `.qe-root` to avoid colliding with
// site-wide class names (.topbar, .toc, .layout, .main, .prose, .callout).
// Keyframes are renamed `qe-*` to avoid clashing with Tailwind's `blink`.

import { useEffect, useState } from 'react'

const MANIFESTO_PASSWORD = 'centro'

const QE_STYLES = String.raw`
.qe-root {
  --base:           #000000;
  --surface:        #080808;
  --elevated:       #111111;
  --hover:          #181818;
  --border:         #242424;
  --border-subtle:  #161616;
  --primary:        #F0F0F0;
  --secondary:      #888888;
  --muted:          #444444;
  --sys-red:        #E63329;
  --sys-orange:     #F97316;
  --sys-amber:      #F59E0B;
  --sys-green:      #4ADE80;
  --eva-orange:     #FF8C00;
  --vibe-gradient: linear-gradient(
    to right,
    #00ffff   0%,
    #0066ff  18%,
    #6600ff  34%,
    #ff00ff  50%,
    #ff0066  62%,
    #ff5500  76%,
    #ff2200  90%,
    #ff0000 100%
  );
  --hazard: repeating-linear-gradient(
    -45deg,
    #F97316 0px 4px,
    #000000 4px 12px
  );
  --font-display: 'Rajdhani', sans-serif;
  --font-grotesk: 'Space Grotesk', sans-serif;
  --font-mono:    'IBM Plex Mono', monospace;

  background-color: var(--base);
  color: var(--secondary);
  font-family: var(--font-grotesk);
  font-size: 16px;
  line-height: 1.65;
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}

.qe-root *,
.qe-root *::before,
.qe-root *::after { box-sizing: border-box; }
.qe-root img,
.qe-root svg { display: block; max-width: 100%; }
.qe-root a { color: inherit; text-decoration: none; }

.qe-root::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 5;
  background-image: repeating-linear-gradient(
    0deg,
    rgba(255,255,255,0.05) 0 1px,
    transparent 1px 3px
  );
}

.qe-root ::selection { background-color: var(--sys-red); color: #000; }

@keyframes qe-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
@keyframes qe-fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes qe-glitch-1 {
  0%, 92%, 100% { transform: translate(2px, 0); }
  93% { transform: translate(-3px, -1px); }
  94% { transform: translate(4px, 2px); }
  95% { transform: translate(-1px, 1px); }
}
@keyframes qe-glitch-2 {
  0%, 88%, 100% { transform: translate(-2px, 0); }
  89% { transform: translate(3px, 1px); }
  90% { transform: translate(-4px, -2px); }
  91% { transform: translate(1px, -1px); }
}

.qe-root .blink-cursor::after {
  content: '▋';
  display: inline-block;
  margin-left: 2px;
  animation: qe-blink 1.2s step-end infinite;
  color: var(--sys-orange);
}

/* ── topbar (de-stickied — site Nav handles the sticky chrome) ── */
.qe-root .topbar {
  position: relative;
  background: var(--base);
  border-bottom: 1px solid var(--border);
}
.qe-root .topbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 0.75rem 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}
.qe-root .topbar-left { display: flex; align-items: center; gap: 0.6rem; min-width: 0; }
.qe-root .topbar-right {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  color: var(--muted);
  flex-shrink: 0;
}
.qe-root .topbar-right .sep { color: var(--border); }
.qe-root .sys-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--sys-orange);
  box-shadow: 0 0 4px var(--sys-orange), 0 0 8px rgba(249,115,22,0.4);
  flex-shrink: 0;
}
.qe-root .sys-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  color: var(--sys-orange);
  text-transform: uppercase;
  white-space: nowrap;
}
.qe-root .sys-label .dim { color: var(--muted); margin: 0 0.4em; }

/* ── progress (de-stickied; scrolls with page) ── */
.qe-root .progress { position: relative; left: 0; height: 2px; background: var(--base); z-index: 60; }
.qe-root .progress-fill { height: 100%; width: 0%; background: var(--vibe-gradient); transition: width 80ms linear; }

/* ── layout ── */
.qe-root .layout {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 3rem;
  max-width: 1400px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem 6rem;
}
@media (max-width: 900px) {
  .qe-root .layout { grid-template-columns: 1fr; gap: 1.5rem; padding: 1.5rem 1rem 4rem; }
}

/* ── TOC ── */
.qe-root .toc {
  position: sticky;
  top: 6rem;
  align-self: start;
  max-height: calc(100vh - 8rem);
  overflow-y: auto;
  padding-right: 0.5rem;
}
.qe-root .toc-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 0.75rem;
  margin-bottom: 0.75rem;
  border-bottom: 1px solid var(--border);
}
.qe-root .toc-header .label { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.2em; color: var(--sys-orange); }

.qe-root .toc-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
}
.qe-root .toc-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 0.2rem;
  border: 1px solid var(--border-subtle);
  text-align: center;
  text-decoration: none;
  transition: border-color 0.15s, background 0.15s;
  min-height: 52px;
  gap: 3px;
}
.qe-root .toc-cell:hover { background: var(--surface); border-color: var(--border); }
.qe-root .toc-cell.active { border-color: var(--sys-orange); }
.qe-root .cell-num {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--muted);
  display: block;
}
.qe-root .cell-label {
  font-family: var(--font-mono);
  font-size: 7.5px;
  letter-spacing: 0.06em;
  color: var(--secondary);
  text-transform: uppercase;
  line-height: 1.25;
  display: block;
}
.qe-root .toc-cell.active .cell-num,
.qe-root .toc-cell.active .cell-label { color: var(--sys-orange); }
.qe-root .toc-cell.toc-center { background: var(--surface); }

@media (max-width: 900px) {
  .qe-root .toc { position: static; max-height: none; padding-right: 0; margin-bottom: 1rem; }
}

/* ── main column ── */
.qe-root .main { min-width: 0; max-width: 760px; }

/* ── hero ── */
.qe-root .hero {
  padding-bottom: 3rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 0;
  position: relative;
}
.qe-root .hero .subsystem { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.25rem; }
.qe-root .hero-title {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(2.75rem, 7vw, 4.5rem);
  line-height: 0.95;
  letter-spacing: -0.02em;
  color: var(--primary);
  margin: 0 0 0.5rem;
}
.qe-root .hero-subtitle {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.55rem;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.3em;
  margin: 0 0 2rem;
}
.qe-root .hero-subtitle .arrow { color: var(--muted); font-family: var(--font-mono); font-weight: 700; }
.qe-root .hero-subtitle .word { color: var(--sys-orange); }
.qe-root .hero-vibe-bar { height: 4px; background: var(--vibe-gradient); margin: 1.5rem 0 2rem; }
.qe-root .hero-quote {
  border-left: 2px solid var(--sys-orange);
  padding: 0.25rem 0 0.25rem 1.25rem;
  margin: 0 0 1.5rem;
  font-family: var(--font-grotesk);
  font-style: italic;
  font-size: 1rem;
  color: var(--primary);
  line-height: 1.55;
}
.qe-root .hero-quote cite {
  display: block;
  margin-top: 0.5rem;
  font-style: normal;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.15em;
  color: var(--muted);
  text-transform: uppercase;
}
.qe-root .hero p { margin: 0 0 1.1rem; color: var(--primary); font-size: 1.05rem; line-height: 1.7; }
.qe-root .hero p.tagline {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.5rem;
  color: var(--sys-orange);
  letter-spacing: 0.02em;
  margin-top: 2rem;
}

/* vibe fader */
.qe-root .vibe-fader { margin: 1.75rem 0 2.25rem; }
.qe-root .vibe-fader-header { display: flex; justify-content: space-between; align-items: baseline; padding: 0 0 0.4rem; }
.qe-root .vibe-label { font-family: var(--font-mono); font-size: 10px; font-weight: 700; letter-spacing: 0.2em; color: var(--primary); text-shadow: 0 0 6px #000, 0 0 12px #000; }
.qe-root .vibe-meta { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; color: var(--muted); text-transform: uppercase; }
.qe-root .vibe-handle-row { position: relative; height: 12px; }
.qe-root .vibe-handle-label {
  position: absolute; top: 0;
  font-family: var(--font-mono); font-size: 9px; font-weight: 700;
  letter-spacing: 0.2em; white-space: nowrap;
  text-shadow: 0 0 8px #000, 0 0 16px #000;
}
.qe-root .vibe-fader-track { position: relative; height: 40px; background: var(--base); overflow: hidden; border-top: 2px solid var(--base); border-bottom: 2px solid var(--base); }
.qe-root .vibe-dash { position: absolute; width: 2.5px; pointer-events: none; }
.qe-root .vibe-handle { position: absolute; top: 0; bottom: 0; width: 3px; background: #fff; box-shadow: 0 0 6px rgba(255,255,255,0.9); pointer-events: none; z-index: 2; }

/* glitch */
.qe-root .glitch { position: relative; display: block; }
.qe-root .glitch-line { position: relative; display: block; line-height: 0.95; }
.qe-root .glitch-line::before,
.qe-root .glitch-line::after { content: attr(data-text); position: absolute; inset: 0; pointer-events: none; }
.qe-root .glitch-line::before { color: #ff3b30; mix-blend-mode: screen; transform: translate(2px,0); clip-path: polygon(0 0,100% 0,100% 45%,0 45%); animation: qe-glitch-1 4.2s steps(2) infinite; opacity: 0.55; }
.qe-root .glitch-line::after  { color: #00d4ff; mix-blend-mode: screen; transform: translate(-2px,0); clip-path: polygon(0 55%,100% 55%,100% 100%,0 100%); animation: qe-glitch-2 4.8s steps(2) infinite; opacity: 0.55; }
@media (prefers-reduced-motion: reduce) {
  .qe-root .glitch-line::before,
  .qe-root .glitch-line::after { animation: none; }
}

/* ── welcome section ── */
.qe-root .welcome-section {
  padding: 3rem 0 3rem;
  border-bottom: 1px solid var(--border);
}
.qe-root .welcome-section .welcome-greeting {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 0.15em;
  color: var(--sys-orange);
  text-transform: uppercase;
  margin: 0 0 1.5rem;
}
.qe-root .welcome-section p {
  margin: 0 0 1.1rem;
  color: var(--secondary);
  line-height: 1.75;
}
.qe-root .welcome-section p strong { color: var(--primary); }
.qe-root .welcome-divider { height: 1px; background: var(--border-subtle); margin: 2rem 0; }
.qe-root .welcome-closing {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-subtle);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  color: var(--muted);
  text-transform: uppercase;
}

/* ── sections ── */
.qe-root section.dossier-section {
  padding-top: 4rem;
  padding-bottom: 1rem;
  scroll-margin-top: 7rem;
}
.qe-root section.dossier-section + section.dossier-section {
  border-top: 1px solid var(--border-subtle);
}
.qe-root .section-head { display: flex; align-items: baseline; gap: 0.85rem; margin-bottom: 0.6rem; }
.qe-root .section-num {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: var(--muted);
  flex-shrink: 0;
}
.qe-root .section-title {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(1.5rem, 3.2vw, 2rem);
  line-height: 1.1;
  letter-spacing: -0.01em;
  color: var(--primary);
  margin: 0;
  text-transform: uppercase;
}
.qe-root .section-motto {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  color: var(--sys-orange);
  text-transform: uppercase;
  margin: 0 0 1.75rem;
  padding-left: calc(12px + 0.85rem + 1.5rem);
}

/* prose */
.qe-root .prose p { margin: 0 0 1.1rem; color: var(--secondary); line-height: 1.7; }
.qe-root .prose p strong,
.qe-root .prose strong { color: var(--primary); font-weight: 600; }
.qe-root .prose em { color: var(--primary); font-style: italic; }
.qe-root .prose ul,
.qe-root .prose ol { margin: 0 0 1.25rem; padding-left: 1.25rem; color: var(--secondary); }
.qe-root .prose ul li,
.qe-root .prose ol li { margin-bottom: 0.45rem; line-height: 1.65; }
.qe-root .prose ul li::marker { color: var(--sys-orange); }
.qe-root .prose ol li::marker { color: var(--sys-orange); font-family: var(--font-mono); font-size: 0.85rem; }
.qe-root .prose h3 {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: var(--sys-orange);
  text-transform: uppercase;
  margin: 2rem 0 0.75rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-subtle);
}
.qe-root .prose h3:first-of-type { border-top: none; padding-top: 0; margin-top: 0; }
.qe-root .flow-line {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  letter-spacing: 0.15em;
  color: var(--sys-orange);
  text-transform: uppercase;
  margin: 0.5rem 0 1.5rem !important;
}

/* ── content type grid ── */
.qe-root .ct-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 3px;
  margin: 0.75rem 0 1.25rem;
}
@media (max-width: 580px) { .qe-root .ct-grid { grid-template-columns: repeat(2, 1fr); } }
.qe-root .ct-card {
  background: var(--surface);
  padding: 1rem 0.75rem 0.65rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.5rem;
}
.qe-root .ct-file {
  width: 52px; height: 62px;
  position: relative;
  flex-shrink: 0;
}
.qe-root .ct-file-bg {
  width: 100%; height: 100%;
  position: absolute; inset: 0;
}
.qe-root .ct-file-bg path,
.qe-root .ct-file-bg polyline {
  stroke: var(--cc); fill: none; stroke-width: 1.2;
}
.qe-root .ct-inner {
  position: absolute;
  top: 54%; left: 50%;
  transform: translate(-50%, -50%);
  color: var(--cc);
}
.qe-root .ct-inner svg { width: 18px; height: 18px; stroke: var(--cc); fill: none; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.qe-root .ct-title {
  font-family: var(--font-display);
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--cc);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 1.1;
}
.qe-root .ct-desc {
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.03em;
  color: var(--secondary);
  line-height: 1.55;
  flex: 1;
}
.qe-root .ct-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  font-family: var(--font-mono);
  font-size: 7.5px;
  letter-spacing: 0.07em;
  color: var(--muted);
  padding-top: 0.45rem;
  border-top: 1px solid var(--border-subtle);
  text-transform: uppercase;
}

/* ── dashboard preview ── */
.qe-root .dash-preview-label {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.22em;
  color: var(--muted);
  text-transform: uppercase;
  margin: 0 0 0.5rem;
}
.qe-root .dash-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
  margin: 0 0 2rem;
}
@media (max-width: 520px) {
  .qe-root .dash-grid { grid-template-columns: 1fr; }
}
.qe-root .dash-card {
  position: relative;
  background: var(--base);
  border-top: 2px solid var(--dc);
  padding: 0.9rem 0.9rem 1.75rem;
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  text-decoration: none;
  min-height: 100px;
}
.qe-root .dash-icon {
  flex-shrink: 0;
  width: 34px; height: 34px;
  border: 1px solid var(--dc);
  display: flex; align-items: center; justify-content: center;
  color: var(--dc);
}
.qe-root .dash-icon svg { width: 18px; height: 18px; stroke: var(--dc); fill: none; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.qe-root .dash-body { flex: 1; min-width: 0; }
.qe-root .dash-title {
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 700;
  color: var(--dc);
  letter-spacing: 0.01em;
  margin-bottom: 0.3rem;
  line-height: 1.1;
}
.qe-root .dash-desc {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.04em;
  color: var(--secondary);
  line-height: 1.55;
}
.qe-root .dash-arrow {
  position: absolute;
  bottom: 0.6rem; right: 0.75rem;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--muted);
}
.qe-root .dash-badge {
  position: absolute;
  top: 0.75rem; right: 0.75rem;
  border: 1px solid var(--dc);
  color: var(--dc);
  font-family: var(--font-mono);
  font-size: 9px;
  padding: 1px 5px;
}

.qe-root .pull-tagline {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.65rem;
  line-height: 1.15;
  letter-spacing: -0.01em;
  color: var(--sys-orange);
  text-transform: uppercase;
  margin: 2rem 0;
  padding: 1rem 0 1rem 1.25rem;
  border-left: 3px solid var(--sys-orange);
}

/* tables */
.qe-root .prose table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; font-family: var(--font-grotesk); font-size: 0.95rem; border: 1px solid var(--border); }
.qe-root .prose th { text-align: left; padding: 0.7rem 0.9rem; background: var(--surface); border-bottom: 1px solid var(--border); font-family: var(--font-mono); font-size: 10px; font-weight: 700; letter-spacing: 0.15em; color: var(--sys-orange); text-transform: uppercase; }
.qe-root .prose td { padding: 0.7rem 0.9rem; border-bottom: 1px solid var(--border-subtle); color: var(--secondary); vertical-align: top; }
.qe-root .prose tr:last-child td { border-bottom: none; }
.qe-root .prose td:first-child { color: var(--primary); font-weight: 500; }
.qe-root .prose td.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; color: var(--primary); text-align: right; }
.qe-root .prose th.num { text-align: right; }

/* callout */
.qe-root .callout {
  position: relative;
  margin: 1.5rem 0;
  padding: 1.25rem 1.5rem;
  background: var(--surface);
  border: 1px solid var(--border);
}
.qe-root .callout::before,
.qe-root .callout::after { content: ''; position: absolute; width: 8px; height: 8px; border-color: var(--sys-red); border-style: solid; }
.qe-root .callout::before { top: -1px; left: -1px; border-width: 1px 0 0 1px; }
.qe-root .callout::after  { bottom: -1px; right: -1px; border-width: 0 1px 1px 0; }
.qe-root .callout p:last-child { margin-bottom: 0; }

/* hazard strip */
.qe-root .hazard-strip { height: 10px; background: var(--hazard); margin: 2.5rem 0; }

/* ── manifesto password gate ── */
.qe-root .manifesto-locked-wrap { position: relative; }
.qe-root .manifesto-content { transition: filter 0.6s ease-out; }
.qe-root [data-locked="true"] .manifesto-content {
  filter: blur(7px) saturate(0.6);
  pointer-events: none;
  user-select: none;
  max-height: 720px;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 65%, transparent 100%);
          mask-image: linear-gradient(to bottom, #000 0%, #000 65%, transparent 100%);
}
.qe-root .manifesto-gate {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 5rem 0 0;
  z-index: 10;
}
.qe-root [data-locked="false"] .manifesto-gate { display: none; }
.qe-root .gate-box {
  position: relative;
  background: var(--surface);
  border: 1px solid rgba(249,115,22,0.55);
  box-shadow: 0 0 14px rgba(249,115,22,0.18), inset 0 0 8px rgba(255,100,0,0.05);
  width: 100%;
  max-width: 440px;
  padding: 1.5rem 1.5rem 1.75rem;
  overflow: hidden;
}
.qe-root .gate-box::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,0,0,0.2) 2px, rgba(0,0,0,0.2) 4px);
}
.qe-root .gate-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; position: relative; z-index: 1; }
.qe-root .gate-header .sys-dot { background: var(--sys-red); box-shadow: 0 0 4px var(--sys-red); }
.qe-root .gate-header .gate-label { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.2em; color: var(--sys-red); text-transform: uppercase; }
.qe-root .gate-desc { font-family: var(--font-grotesk); font-size: 0.88rem; color: var(--secondary); line-height: 1.55; margin: 0 0 1.25rem; position: relative; z-index: 1; }
.qe-root .gate-form { display: flex; flex-direction: column; gap: 0.6rem; position: relative; z-index: 1; }
.qe-root .gate-field { display: flex; flex-direction: column; gap: 0.3rem; }
.qe-root .gate-field label { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.18em; color: var(--muted); text-transform: uppercase; }
.qe-root .gate-field input { background: var(--base); border: 1px solid var(--border); padding: 0.55rem 0.75rem; color: var(--primary); font-family: var(--font-mono); font-size: 0.92rem; outline: none; transition: border-color 0.15s; letter-spacing: 0.1em; }
.qe-root .gate-field input:focus { border-color: var(--sys-orange); }
.qe-root .gate-submit { margin-top: 0.4rem; background: rgba(249,115,22,0.08); border: 1px solid var(--sys-orange); color: var(--sys-orange); padding: 0.6rem 1rem; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.2em; cursor: pointer; transition: background 0.15s, color 0.15s; }
.qe-root .gate-submit:hover { background: rgba(249,115,22,0.18); color: var(--primary); }
.qe-root .gate-error { margin-top: 0.3rem; padding: 0.45rem 0.6rem; background: rgba(230,51,41,0.08); border: 1px solid var(--sys-red); color: var(--sys-red); font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.18em; display: none; }
.qe-root .gate-error.show { display: block; }

/* manifesto content styles */
.qe-root .manifesto { padding-top: 2rem; }
.qe-root .manifesto p { color: var(--secondary); line-height: 1.75; margin: 0 0 1.15rem; }
.qe-root .manifesto h3 {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.25rem;
  line-height: 1.15;
  letter-spacing: 0.02em;
  color: var(--sys-orange);
  text-transform: uppercase;
  margin: 2.5rem 0 1rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--border-subtle);
}
.qe-root .manifesto h3:first-of-type { border-top: none; padding-top: 0; margin-top: 0; }
.qe-root .manifesto-vibe-bar { height: 6px; background: var(--vibe-gradient); margin: 0 0 2.5rem; }

/* closing line */
.qe-root .closing-line {
  margin: 4rem 0 0;
  padding: 2rem 0 0;
  border-top: 1px solid var(--border);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.25rem;
  line-height: 1.4;
  color: var(--primary);
  text-align: center;
  letter-spacing: -0.005em;
}

/* ── footer ── */
.qe-root .site-footer { border-top: 1px solid var(--border); background: var(--base); padding: 1rem 1.5rem; margin-top: 4rem; }
.qe-root .footer-inner {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem 1.5rem;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  color: var(--muted);
}
.qe-root .footer-inner .group { display: flex; align-items: center; gap: 0.5rem; }
.qe-root .footer-inner .sep { color: var(--border); }
.qe-root .footer-inner .unit { color: rgba(249,115,22,0.7); }

@media (max-width: 900px) {
  .qe-root .topbar-right .show-md { display: none; }
}

/* ── print ── */
@media print {
  .qe-root {
    --base:#fff; --surface:#fff; --primary:#000; --secondary:#222; --muted:#555; --border:#ccc; --border-subtle:#eee;
    background: #fff !important;
  }
  .qe-root .topbar,
  .qe-root .progress,
  .qe-root .toc,
  .qe-root .site-footer { display: none !important; }
  .qe-root .layout { grid-template-columns: 1fr; gap: 0; padding: 0; max-width: 100%; }
  .qe-root .main { max-width: 100%; }
  .qe-root .glitch-line::before,
  .qe-root .glitch-line::after { display: none !important; }
  .qe-root [data-locked="true"] .manifesto-content { filter: none !important; pointer-events: auto !important; user-select: auto !important; max-height: none !important; overflow: visible !important; -webkit-mask-image: none !important; mask-image: none !important; }
  .qe-root .manifesto-gate { display: none !important; }
}
`

export default function AboutPage() {
  const [locked, setLocked] = useState(true)
  const [code, setCode] = useState('')
  const [errorShown, setErrorShown] = useState(false)

  const submitGate = () => {
    if (code.trim().toLowerCase() === MANIFESTO_PASSWORD.toLowerCase()) {
      setLocked(false)
      setErrorShown(false)
    } else {
      setErrorShown(true)
      setCode('')
      const input = document.getElementById('gateInput') as HTMLInputElement | null
      input?.focus()
    }
  }

  useEffect(() => {
    // UTC clock — matches the invitation's topbar-right //UTC tick.
    const updateClock = () => {
      const now = new Date()
      const h = String(now.getUTCHours()).padStart(2, '0')
      const m = String(now.getUTCMinutes()).padStart(2, '0')
      const s = String(now.getUTCSeconds()).padStart(2, '0')
      const el = document.getElementById('utcClock')
      if (el) el.textContent = `UTC ${h}:${m}:${s}`
    }
    updateClock()
    const clockId = setInterval(updateClock, 1000)

    // Reading-progress vibe bar at the very top of the page content.
    const onScroll = () => {
      const el = document.getElementById('progressFill')
      if (!el) return
      const doc = document.documentElement
      const scrolled = doc.scrollTop || document.body.scrollTop
      const total = doc.scrollHeight - doc.clientHeight
      el.style.width = total > 0 ? `${(scrolled / total) * 100}%` : '0%'
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    // TOC active-cell highlight — IntersectionObserver fires as each section
    // crosses the band 20%-30% from the top of the viewport.
    const tocCells = document.querySelectorAll<HTMLElement>('.qe-root .toc-cell[data-target]')
    const activateCell = (id: string) => {
      tocCells.forEach((cell) => {
        cell.classList.toggle('active', cell.dataset.target === id)
      })
    }
    const checkTop = () => {
      if (window.scrollY < 80) activateCell('bienvenido')
    }
    window.addEventListener('scroll', checkTop, { passive: true })
    checkTop()

    const sections = document.querySelectorAll<HTMLElement>('.qe-root section[id]')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) activateCell(entry.target.id)
        })
      },
      { rootMargin: '-20% 0px -70% 0px' },
    )
    sections.forEach((s) => observer.observe(s))

    // Phosphor-tape vibe fader — mirrors VibeSlider's track render.
    const buildFader = () => {
      const vibeTrack = document.getElementById('vibeFaderTrack')
      if (!vibeTrack || vibeTrack.querySelector('.vibe-dash')) return
      const STOPS: [number, [number, number, number]][] = [
        [0.0, [0, 255, 255]],
        [1.8, [0, 102, 255]],
        [3.4, [102, 0, 255]],
        [5.0, [255, 0, 255]],
        [6.2, [255, 0, 102]],
        [7.6, [255, 85, 0]],
        [9.0, [255, 34, 0]],
        [10.0, [255, 0, 0]],
      ]
      const interp = (v: number) => {
        for (let i = 0; i < STOPS.length - 1; i++) {
          const a = STOPS[i]
          const b = STOPS[i + 1]
          if (v >= a[0] && v <= b[0]) {
            const t = (v - a[0]) / (b[0] - a[0])
            return (
              'rgb(' +
              Math.round(a[1][0] + (b[1][0] - a[1][0]) * t) +
              ',' +
              Math.round(a[1][1] + (b[1][1] - a[1][1]) * t) +
              ',' +
              Math.round(a[1][2] + (b[1][2] - a[1][2]) * t) +
              ')'
            )
          }
        }
        return 'rgb(255,0,0)'
      }
      const hash01 = (seed: number, salt: number) => {
        let x = Math.imul(seed | 0, 2654435761) ^ Math.imul(salt | 0, 1597334677)
        x = Math.imul(x ^ (x >>> 16), 2246822519) | 0
        x = Math.imul(x ^ (x >>> 13), 3266489917) | 0
        x = x ^ (x >>> 16)
        return (x >>> 0) / 4294967296
      }
      const rows = [
        { count: 120, bottom: 50, halfStep: false, wLo: 4, wHi: 6, salt: 10 },
        { count: 40, bottom: 68, halfStep: false, wLo: 3, wHi: 5, salt: 20 },
        { count: 40, bottom: 32, halfStep: true, wLo: 3, wHi: 5, salt: 30 },
      ]
      const frag = document.createDocumentFragment()
      rows.forEach((row) => {
        for (let i = 0; i < row.count; i++) {
          const t = (i + (row.halfStep ? 0.5 : 0)) / row.count
          if (t > 0.995) continue
          const vibe = t * 10
          const width = row.wLo + Math.floor(hash01(i, row.salt) * (row.wHi - row.wLo + 1))
          const color = interp(vibe)
          const dash = document.createElement('div')
          dash.className = 'vibe-dash'
          dash.style.left = Math.round(t * 9900) / 100 + '%'
          dash.style.bottom = row.bottom + '%'
          dash.style.height = width + 'px'
          dash.style.backgroundColor = color
          dash.style.boxShadow = '0 0 3px ' + color
          frag.appendChild(dash)
        }
      })
      const firstHandle = vibeTrack.querySelector('.vibe-handle')
      if (firstHandle) vibeTrack.insertBefore(frag, firstHandle)
      else vibeTrack.appendChild(frag)
    }
    buildFader()

    return () => {
      clearInterval(clockId)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('scroll', checkTop)
      observer.disconnect()
    }
  }, [])

  return (
    // -mx/-mt/-mb negate the root layout's padding so topbar + footer reach
    // the viewport edges like in the standalone invitation.
    <div className="qe-root -mx-4 -mt-4 -mb-24 md:-mx-8">
      <style dangerouslySetInnerHTML={{ __html: QE_STYLES }} />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap"
      />

      <div className="progress">
        <div className="progress-fill" id="progressFill" />
      </div>

      <header className="topbar">
        <div className="topbar-inner">
          <div className="topbar-left">
            <span className="sys-dot" aria-hidden="true" />
            <span className="sys-label">
              //TRANSMISIÓN<span className="dim">·</span>PRIVADA
            </span>
          </div>
          <div className="topbar-right">
            <span className="show-md">GRADIENTE</span>
            <span className="sep show-md">·</span>
            <span>BETA·150</span>
            <span className="sep">·</span>
            <span id="utcClock" className="tabular">
              UTC --:--:--
            </span>
            <span className="sep show-md">·</span>
            <span className="blink-cursor show-md">ACCESO·RESTRINGIDO</span>
          </div>
        </div>
      </header>

      <div className="layout">
        {/* TOC */}
        <aside className="toc" aria-label="Índice">
          <div className="toc-header">
            <span className="sys-dot" aria-hidden="true" />
            <span className="label">//ÍNDICE</span>
          </div>
          <div className="toc-grid" id="tocGrid">
            <a href="#bienvenido" className="toc-cell" data-target="bienvenido">
              <span className="cell-num">--</span>
              <span className="cell-label">Bienvenido</span>
            </a>
            <a href="#s01" className="toc-cell" data-target="s01">
              <span className="cell-num">01</span>
              <span className="cell-label">Qué es</span>
            </a>
            <a href="#s02" className="toc-cell" data-target="s02">
              <span className="cell-num">02</span>
              <span className="cell-label">Para qué</span>
            </a>
            <a href="#s07" className="toc-cell" data-target="s07">
              <span className="cell-num">07</span>
              <span className="cell-label">Guía</span>
            </a>
            <a href="#s08" className="toc-cell toc-center" data-target="s08">
              <span className="cell-num">08</span>
              <span className="cell-label">Manifiesto 🔒</span>
            </a>
            <a href="#s03" className="toc-cell" data-target="s03">
              <span className="cell-num">03</span>
              <span className="cell-label">Quiénes</span>
            </a>
            <a href="#s06" className="toc-cell" data-target="s06">
              <span className="cell-num">06</span>
              <span className="cell-label">Convocatorias</span>
            </a>
            <a href="#s05" className="toc-cell" data-target="s05">
              <span className="cell-num">05</span>
              <span className="cell-label">Estructura</span>
            </a>
            <a href="#s04" className="toc-cell" data-target="s04">
              <span className="cell-num">04</span>
              <span className="cell-label">Calibración</span>
            </a>
          </div>
        </aside>

        {/* MAIN */}
        <main className="main">
          {/* HERO */}
          <section className="hero" aria-labelledby="hero-title">
            <div className="subsystem">
              <span className="sys-dot" aria-hidden="true" />
              <span className="sys-label">
                //BETA<span className="dim">·</span>150
              </span>
            </div>
            <h1 id="hero-title" className="hero-title glitch">
              <span className="glitch-line" data-text="GRADIENTE">
                GRADIENTE
              </span>
              <span className="glitch-line" data-text="MX">
                MX
              </span>
            </h1>
            <p className="hero-subtitle">
              <span className="word">COMUNIDAD</span>
              <span className="arrow">→</span>
              <span className="word">INFRAESTRUCTURA</span>
              <span className="arrow">→</span>
              <span className="word">MEMORIA</span>
              <span className="arrow">→</span>
              <span className="word">ESCENA</span>
            </p>

            <blockquote className="hero-quote">
              Treinta rayos convergen en el cubo de una rueda; es el agujero en el centro lo que la hace útil.
              <cite>Lao Tzu · Tao Te Ching · XI</cite>
            </blockquote>

            <p>
              La cultura no se transmite desde un punto hacia afuera: se construye cuando personas distintas
              convergen hacia un centro compartido por todos y definido por nadie.
            </p>
            <p className="tagline">LA PUERTA ESTÁ ABIERTA.</p>
          </section>

          {/* BIENVENIDA — activation copy + access-block stripped for public /about */}
          <section id="bienvenido" className="welcome-section">
            <p className="welcome-greeting">Bienvenido.</p>

            <p>
              Si llegó esto a tus manos es porque confiamos en lo que piensas, lo que haces y lo que puedes
              aportar aquí.
            </p>

            <p>
              Te invitamos a la beta cerrada de Gradiente: un espacio para la música construido para ser
              democrático, descentralizado y propiamente nuestro. Un lugar para estar más cerca de tu
              comunidad, sin depender de redes que consumen tu trabajo sin devolver nada.
            </p>

            <p>Más sobre la plataforma en las secciones siguientes.</p>

            <div className="welcome-closing">El archivo no tiene dueños. Solo custodios temporales.</div>
          </section>

          {/* 01 */}
          <section id="s01" className="dossier-section">
            <header className="section-head">
              <span className="section-num">01</span>
              <h2 className="section-title">Qué es Gradiente</h2>
            </header>
            <p className="section-motto">PERSONAS, NO PLATAFORMAS</p>
            <div className="prose">
              <p>
                Gradiente es infraestructura y memoria para la escena underground de música y arte sonoro
                en México. Un foro descentralizado, refugio y respuesta a la cultura del algoritmo: listado de
                eventos, periodismo musical, reseñas, mixes, foro y marketplace. Debajo hay un sistema
                técnicamente sofisticado que posibilita un ecosistema vivo: los contenidos suben, bajan,
                crecen, se hunden y resucitan según lo que generan en la comunidad. Por fuera, todo es
                intuitivo e inmediato.
              </p>
            </div>
          </section>

          {/* 02 */}
          <section id="s02" className="dossier-section">
            <header className="section-head">
              <span className="section-num">02</span>
              <h2 className="section-title">Para qué</h2>
            </header>
            <p className="section-motto">CUANDO EL MUNDO SE DESARMA, LA COMUNIDAD ES LA MEDICINA.</p>
            <div className="prose">
              <p>
                Las plataformas que moldean cómo descubrimos y compartimos música fueron construidas desde
                otros contextos, con fines <strong>extractivos y parasitarios</strong>. No devuelven nada a
                la cultura que consumen.
              </p>
              <p>
                Gradiente surge desde aquí, desde una ciudad y una escena que co-habitamos. La intención es
                hacer esa realidad más sana: mejor conectada, mejor informada. Un espacio para el diálogo, la
                reflexión y una forma de promoción más personal y colectiva, sin alimentar a las plataformas
                que nos están demoralizando.
              </p>
            </div>
          </section>

          {/* 03 */}
          <section id="s03" className="dossier-section">
            <header className="section-head">
              <span className="section-num">03</span>
              <h2 className="section-title">Quiénes somos</h2>
            </header>
            <p className="section-motto">CADA UNO ES UN CENTRO</p>
            <div className="prose">
              <p>
                Gradiente nació desde adentro de la escena: promotores, DJs, periodistas y colectivos que
                decidieron construir el espacio que la escena necesitaba en lugar de seguir dependiendo de
                plataformas que consumen el trabajo de la comunidad sin devolver nada. Cada sello, colectivo
                y espacio tiene aquí un lugar para plasmar su filosofía, publicar sus mixes, archivar sus
                reseñas y construir una relación directa y completa con su público, más allá de posts y memes
                en Instagram. El contenido que generan no desaparece en el vacío de un algoritmo: vive, se
                cultiva, construye comunidad y nicho con el tiempo.
              </p>
              <p>
                Equipo core de 13 personas, más colaboradores de inside editorial. Todos con piel en el juego
                desde el día uno.
              </p>
            </div>
          </section>

          {/* 04 */}
          <section id="s04" className="dossier-section">
            <header className="section-head">
              <span className="section-num">04</span>
              <h2 className="section-title">Calibración analógica</h2>
            </header>
            <p className="section-motto">TECNOLOGÍA ESCONDIDA. FORMATO ANÁLOGO.</p>
            <div className="prose">
              <p>
                El género como único organizador es una mentira. Reduce lo que es continuo y separa lo que
                naturalmente conversa entre sí. Hay techno que medita y techno que detona. Hay jazz de tres
                de la mañana y jazz que es una pared de ruido. La etiqueta no te dice nada de eso.
              </p>
              <p>
                En la parte superior de la página hay un fader continuo de 0 (glacial) a 10 (volcán). Un solo
                gesto. Lo mueves y el sistema reorganiza todo en tiempo real según esa intensidad. Cada pieza
                propone un valor inicial desde su autor, contexto y metadata; la comunidad lo refina con su
                lectura, haciendo vibe check. A esto le llamamos calibración analógica.
              </p>

              <div className="vibe-fader" aria-hidden="true">
                <div className="vibe-fader-header">
                  <span className="vibe-label">VIBE</span>
                  <span className="vibe-meta">0 → 10 · CALIBRACIÓN ANALÓGICA</span>
                </div>
                <div className="vibe-handle-row">
                  <span className="vibe-handle-label" style={{ left: '0%', color: '#00ffff' }}>
                    GLACIAL
                  </span>
                  <span className="vibe-handle-label" style={{ right: '0%', color: '#ff0000' }}>
                    VOLCÁN
                  </span>
                </div>
                <div className="vibe-fader-track" id="vibeFaderTrack">
                  <div className="vibe-handle" style={{ left: '0%' }} />
                  <div className="vibe-handle" style={{ left: 'calc(100% - 3px)' }} />
                </div>
              </div>

              <p>
                Debajo de ese gesto corre un sistema técnicamente denso: cada pieza es catalogada, cuantificada
                y archivada con su propia capa de metadata. El sistema lee el contexto, el autor, las reacciones,
                el tiempo, la energía que genera. Todo eso se reduce a dos señales visibles: su posición en el
                grid y el <strong>Half Life</strong> actualizado.
              </p>
              <p>
                El Half Life es la energía propia de cada pieza. Nace con un valor inicial, decae con el tiempo
                y se renueva cuando la comunidad interactúa con ella. Lo que no recibe atención no desaparece:
                se archiva, sigue vivo dentro del ecosistema y puede resucitar cuando vuelva a ser relevante,
                cuando el contexto cambie, o cuando alguien lo descubra de nuevo. Lo que haces aquí no se
                desperdicia: se cultiva y se nutre en su respectivo nicho.
              </p>
              <p>Es un organismo vivo que mantenemos y cultivamos juntos. Por fuera parece una parrilla o un foro.</p>
            </div>
          </section>

          {/* 05 */}
          <section id="s05" className="dossier-section">
            <header className="section-head">
              <span className="section-num">05</span>
              <h2 className="section-title">Estructura comunitaria</h2>
            </header>
            <p className="section-motto">GUÍAS, NO PORTEROS</p>
            <div className="prose">
              <p>
                Los roles suben y bajan de manera orgánica según tu enfoque, tu tipo de participación y lo
                que generas en la comunidad.
              </p>
              <p>
                Si recibiste esta invitación, ya fuiste colocado automáticamente en los rangos superiores.
                Tendrás acceso a más opciones desde el primer momento.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Rol</th>
                    <th>Capacidad</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>USER</td>
                    <td>Comentar, reaccionar, postear en el foro, guardar items</td>
                  </tr>
                  <tr>
                    <td>CURATOR</td>
                    <td>+ Listicles, encuestas, marketplace</td>
                  </tr>
                  <tr>
                    <td>GUIDE</td>
                    <td>+ Opiniones, mixes: voz editorial</td>
                  </tr>
                  <tr>
                    <td>INSIDER</td>
                    <td>Mismo nivel que GUIDE, firma desde la escena</td>
                  </tr>
                  <tr>
                    <td>ADMIN</td>
                    <td>Todo. Asigna roles, modera, edita</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 06 */}
          <section id="s06" className="dossier-section">
            <header className="section-head">
              <span className="section-num">06</span>
              <h2 className="section-title">Convocatorias</h2>
            </header>
            <p className="section-motto">TU GUSTO VALE ORO</p>
            <div className="prose">
              <p>
                Cada mes cierra una convocatoria y sus resultados se anuncian y pagan en el Evento Gradiente
                MX del mes. La convocatoria existe para fomentar el pensamiento crítico, el hábito de
                compartir, y sobre todo un periodismo musical independiente y accesible.
              </p>
              <ul>
                <li>
                  <strong>Prize pool:</strong> 10,000 MXN por convocatoria, repartidos por categoría según
                  HL acumulado al cierre del mes.
                </li>
                <li>Sin jurado. La comunidad decide por HL.</li>
              </ul>
              <table>
                <thead>
                  <tr>
                    <th>Categoría</th>
                    <th className="num">Premio</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Editorial</td>
                    <td className="num">4,500 MXN</td>
                  </tr>
                  <tr>
                    <td>Artículo</td>
                    <td className="num">2,500 MXN</td>
                  </tr>
                  <tr>
                    <td>Opinión</td>
                    <td className="num">500 MXN</td>
                  </tr>
                  <tr>
                    <td>Review</td>
                    <td className="num">500 MXN</td>
                  </tr>
                  <tr>
                    <td>Listicle</td>
                    <td className="num">500 MXN</td>
                  </tr>
                  <tr>
                    <td>Foro</td>
                    <td className="num">500 MXN</td>
                  </tr>
                </tbody>
              </table>
              <p>El premio reconoce lo que la escena produce. La comunidad es el jurado.</p>
            </div>
          </section>

          {/* 07 GUÍA DE USUARIO */}
          <section id="s07" className="dossier-section">
            <header className="section-head">
              <span className="section-num">07</span>
              <h2 className="section-title">Guía de usuario</h2>
            </header>
            <p className="section-motto">TODO EMPIEZA EN EL DASHBOARD.</p>

            <p className="dash-preview-label">// tu dashboard</p>
            <div className="dash-grid">
              <div className="dash-card" style={{ ['--dc' as string]: '#F97316' } as React.CSSProperties}>
                <div className="dash-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                </div>
                <div className="dash-body">
                  <div className="dash-title">Nuevo contenido</div>
                  <div className="dash-desc">
                    Elige una plantilla y compón. Mix, evento, review, editorial, opinión, lista, artículo,
                    noticia.
                  </div>
                </div>
                <span className="dash-arrow">→</span>
              </div>

              <div className="dash-card" style={{ ['--dc' as string]: '#00d4ff' } as React.CSSProperties}>
                <div className="dash-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <div className="dash-body">
                  <div className="dash-title">Drafts</div>
                  <div className="dash-desc">
                    Bandeja de borradores activos. Color por tipo, posiciones libres.
                  </div>
                </div>
                <span className="dash-arrow">→</span>
              </div>

              <div className="dash-card" style={{ ['--dc' as string]: '#4ADE80' } as React.CSSProperties}>
                <div className="dash-icon">
                  <svg viewBox="0 0 24 24">
                    <polyline points="21 8 21 21 3 21 3 8" />
                    <rect x="1" y="3" width="22" height="5" />
                    <line x1="10" y1="12" x2="14" y2="12" />
                  </svg>
                </div>
                <div className="dash-body">
                  <div className="dash-title">Publicados</div>
                  <div className="dash-desc">
                    Lo que ya soltaste. Versión local de la sesión, listo para revisar.
                  </div>
                </div>
                <span className="dash-badge">24</span>
                <span className="dash-arrow">→</span>
              </div>

              <div className="dash-card" style={{ ['--dc' as string]: '#a855f7' } as React.CSSProperties}>
                <div className="dash-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div className="dash-body">
                  <div className="dash-title">Perfil</div>
                  <div className="dash-desc">Identidad editorial. Bio, firma, pronombres, ciudad.</div>
                </div>
                <span className="dash-arrow">→</span>
              </div>
            </div>

            <div className="prose">
              <h3>Acceso</h3>
              <p>
                Entraste por invitación. Para publicar necesitas estar logueado. Todo vive y comienza en tu
                dashboard: ícono de perfil arriba a la derecha.
              </p>

              <h3>Tu perfil</h3>
              <p>Tienes dos capas de identidad. Pueden coexistir.</p>
              <table>
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Para qué</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>USUARIO</td>
                    <td>Publicas con tu nombre, acumulas reacciones, recibes un rango automático</td>
                  </tr>
                  <tr>
                    <td>PARTNER</td>
                    <td>
                      Para sellos, promotoras, colectivos, espacios. Perfil propio, marketplace integrado,
                      equipo con permisos para publicar desde el espacio del partner
                    </td>
                  </tr>
                </tbody>
              </table>

              <h3>Roles</h3>
              <p>
                Los roles son acumulativos. Cada nivel hereda el anterior. Subir de rol es automático —
                requiere participar y crear. Si quieres publicar algo que tu rol no permite todavía, contacta
                a un admin.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Rol</th>
                    <th>Capacidad</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>USUARIO</td>
                    <td>Comentar, reaccionar, foro, guardar, votar</td>
                  </tr>
                  <tr>
                    <td>CURADOR</td>
                    <td>+ Listicles, encuestas, marketplace</td>
                  </tr>
                  <tr>
                    <td>GUÍA</td>
                    <td>+ Opiniones, mixes (voz editorial)</td>
                  </tr>
                  <tr>
                    <td>INSIDER</td>
                    <td>Igual que GUÍA, firma desde la escena</td>
                  </tr>
                  <tr>
                    <td>ADMIN</td>
                    <td>Todo. Asigna roles, edita, borra</td>
                  </tr>
                </tbody>
              </table>

              <h3>Tipos de contenido</h3>
              <div className="ct-grid">
                <div className="ct-card" style={{ ['--cc' as string]: '#00d4ff' } as React.CSSProperties}>
                  <div className="ct-file">
                    <svg className="ct-file-bg" viewBox="0 0 52 62">
                      <path d="M6 2h26l14 14v44H6z" />
                      <polyline points="32 2 32 16 46 16" />
                    </svg>
                    <div className="ct-inner">
                      <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="9" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </div>
                  </div>
                  <div className="ct-title">Mix</div>
                  <div className="ct-desc">DJ set, radio show o mixtape. Multi-source, tracklist, contexto.</div>
                  <div className="ct-footer">
                    <span>PLANTILLA.MIX</span>
                    <span>2.1 KB</span>
                  </div>
                </div>

                <div className="ct-card" style={{ ['--cc' as string]: '#F97316' } as React.CSSProperties}>
                  <div className="ct-file">
                    <svg className="ct-file-bg" viewBox="0 0 52 62">
                      <path d="M6 2h26l14 14v44H6z" />
                      <polyline points="32 2 32 16 46 16" />
                    </svg>
                    <div className="ct-inner">
                      <svg viewBox="0 0 24 24">
                        <line x1="8" y1="6" x2="21" y2="6" />
                        <line x1="8" y1="12" x2="21" y2="12" />
                        <line x1="8" y1="18" x2="21" y2="18" />
                        <line x1="3" y1="6" x2="3.01" y2="6" />
                        <line x1="3" y1="12" x2="3.01" y2="12" />
                        <line x1="3" y1="18" x2="3.01" y2="18" />
                      </svg>
                    </div>
                  </div>
                  <div className="ct-title">Lista</div>
                  <div className="ct-desc">Recuento editorial ranked. Top-N tracks con comentario por pista.</div>
                  <div className="ct-footer">
                    <span>PLANTILLA.LST</span>
                    <span>1.6 KB</span>
                  </div>
                </div>

                <div className="ct-card" style={{ ['--cc' as string]: '#d4a017' } as React.CSSProperties}>
                  <div className="ct-file">
                    <svg className="ct-file-bg" viewBox="0 0 52 62">
                      <path d="M6 2h26l14 14v44H6z" />
                      <polyline points="32 2 32 16 46 16" />
                    </svg>
                    <div className="ct-inner">
                      <svg viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                    </div>
                  </div>
                  <div className="ct-title">Artículo</div>
                  <div className="ct-desc">Longform reportado. Bloques estructurados, citas, footnotes.</div>
                  <div className="ct-footer">
                    <span>PLANTILLA.ART</span>
                    <span>2.4 KB</span>
                  </div>
                </div>

                <div className="ct-card" style={{ ['--cc' as string]: '#E63329' } as React.CSSProperties}>
                  <div className="ct-file">
                    <svg className="ct-file-bg" viewBox="0 0 52 62">
                      <path d="M6 2h26l14 14v44H6z" />
                      <polyline points="32 2 32 16 46 16" />
                    </svg>
                    <div className="ct-inner">
                      <svg viewBox="0 0 24 24">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </div>
                  </div>
                  <div className="ct-title">Evento</div>
                  <div className="ct-desc">Fecha en CDMX. Venue, line-up, boletos, rango horario.</div>
                  <div className="ct-footer">
                    <span>PLANTILLA.EVT</span>
                    <span>1.8 KB</span>
                  </div>
                </div>

                <div className="ct-card" style={{ ['--cc' as string]: '#F59E0B' } as React.CSSProperties}>
                  <div className="ct-file">
                    <svg className="ct-file-bg" viewBox="0 0 52 62">
                      <path d="M6 2h26l14 14v44H6z" />
                      <polyline points="32 2 32 16 46 16" />
                    </svg>
                    <div className="ct-inner">
                      <svg viewBox="0 0 24 24">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </div>
                  </div>
                  <div className="ct-title">Review</div>
                  <div className="ct-desc">Crítica de disco o evento. Cuerpo corto, vibe, calificación implícita.</div>
                  <div className="ct-footer">
                    <span>PLANTILLA.REV</span>
                    <span>2.0 KB</span>
                  </div>
                </div>

                <div className="ct-card" style={{ ['--cc' as string]: '#84cc16' } as React.CSSProperties}>
                  <div className="ct-file">
                    <svg className="ct-file-bg" viewBox="0 0 52 62">
                      <path d="M6 2h26l14 14v44H6z" />
                      <polyline points="32 2 32 16 46 16" />
                    </svg>
                    <div className="ct-inner">
                      <svg viewBox="0 0 24 24">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ct-title">Editorial</div>
                  <div className="ct-desc">Texto curatorial largo. Posición, escena, firma.</div>
                  <div className="ct-footer">
                    <span>PLANTILLA.EDI</span>
                    <span>2.2 KB</span>
                  </div>
                </div>

                <div className="ct-card" style={{ ['--cc' as string]: '#a855f7' } as React.CSSProperties}>
                  <div className="ct-file">
                    <svg className="ct-file-bg" viewBox="0 0 52 62">
                      <path d="M6 2h26l14 14v44H6z" />
                      <polyline points="32 2 32 16 46 16" />
                    </svg>
                    <div className="ct-inner">
                      <svg viewBox="0 0 24 24">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ct-title">Opinión</div>
                  <div className="ct-desc">Columna firmada. Postura individual sobre la escena.</div>
                  <div className="ct-footer">
                    <span>PLANTILLA.OPI</span>
                    <span>1.7 KB</span>
                  </div>
                </div>

                <div className="ct-card" style={{ ['--cc' as string]: '#F0F0F0' } as React.CSSProperties}>
                  <div className="ct-file">
                    <svg className="ct-file-bg" viewBox="0 0 52 62">
                      <path d="M6 2h26l14 14v44H6z" />
                      <polyline points="32 2 32 16 46 16" />
                    </svg>
                    <div className="ct-inner">
                      <svg viewBox="0 0 24 24">
                        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 0-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
                        <path d="M18 14h-8" />
                        <path d="M15 18h-5" />
                        <path d="M10 6h8v4h-8z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ct-title">Noticia</div>
                  <div className="ct-desc">Nota corta. Dato rápido. Lo que está pasando ahora.</div>
                  <div className="ct-footer">
                    <span>PLANTILLA.NOT</span>
                    <span>1.8 KB</span>
                  </div>
                </div>
              </div>
              <p>Si dudas: escoge el tipo más corto que sirva. ¿Por qué no compartes una lista de tus discos favoritos?</p>

              <h3>Cómo publicar</h3>
              <ol>
                <li>Dashboard → NUEVO → escoge el tipo</li>
                <li>
                  Llena el form: título concreto sin clickbait, imagen obligatoria, cuerpo en markdown con
                  música embebida (Bandcamp / SoundCloud / Spotify), vibe de 0 a 10, géneros y etiquetas
                </li>
                <li>Guardar draft: privado, solo tú lo ves</li>
                <li>Publicar: la pieza pasa a PENDIENTE (chip rojo, solo visible para ti)</li>
                <li>Confirmar → modal con preview final → Publicar definitivamente</li>
              </ol>
              <p className="flow-line">DRAFT → PENDIENTE → PUBLICADO</p>

              <h3>Después de publicar</h3>
              <p>
                Tu pieza nace con HL: energía que decae con el tiempo y se renueva si la comunidad la toca.
                No hay likes ni contadores visibles. El tamaño y la posición en el feed son la única señal.
                Puedes editar y borrar desde tu Dashboard → PUBLICADOS.
              </p>

              <h3>El foro</h3>
              <p>Imageboard-style. Hilos con imagen obligatoria, respuestas planas, &gt;&gt;id para citar.</p>
              <ul>
                <li>Abrir hilo: /foro → + NUEVO HILO → imagen + título + géneros + mensaje</li>
                <li>Responder: click en el hilo → caja al final → &gt;&gt;id para citar a alguien</li>
              </ul>
              <p>
                Los hilos hacen bump con cada respuesta. Límite de 30 hilos abiertos: los más viejos se
                cierran cuando se llena.
              </p>

              <h3>Tu HL</h3>
              <p>
                Sube cuando publicas, posteas o respondes en el foro, comentas bajo una pieza, recibes
                reacciones en tus comentarios, guardas items o tus piezas reciben interacción.
              </p>
              <p>
                Por qué importa: las convocatorias mensuales reparten dinero entre los posts con más HL. A
                futuro, HL será canjeable.
              </p>

              <h3>Comentarios y reacciones</h3>
              <p>
                Para abrir comentarios de cualquier pieza: click en el botón derecho de la tarjeta. Dos
                reacciones, solo dos:
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Reacción</th>
                    <th>Significado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>[!] SEÑAL</td>
                    <td>Algo prende, algo importa, algo detona</td>
                  </tr>
                  <tr>
                    <td>[?] DUDA</td>
                    <td>Algo abre pregunta, algo te perturba</td>
                  </tr>
                </tbody>
              </table>
              <p>
                Las reacciones que recibes definen tu rango automático: NORMIE, DETONADOR, ENIGMA o ESPECTRO.
                El rango se mueve solo.
              </p>

              <h3>Lo que no tienes que hacer</h3>
              <ul>
                <li>No pelees por aparecer arriba. El HL lo hace solo.</li>
                <li>No pongas 8 etiquetas. Tres precisas valen más.</li>
                <li>No uses IA para escribir. Para ortografía, ok. Para pensar por ti, no.</li>
                <li>No tienes que saber escribir bien. Solo tener algo que decir.</li>
              </ul>
            </div>
          </section>

          {/* 08 MANIFIESTO — gated by password */}
          <section
            id="s08"
            className="dossier-section manifesto-locked-wrap"
            data-locked={locked ? 'true' : 'false'}
          >
            <header className="section-head">
              <span className="section-num">08</span>
              <h2 className="section-title">Manifiesto</h2>
            </header>

            <div className="manifesto-gate">
              <div className="gate-box">
                <div className="gate-header">
                  <span className="sys-dot" aria-hidden="true" />
                  <span className="gate-label">// ACCESO RESTRINGIDO</span>
                </div>
                <p className="gate-desc">Obtén la contraseña a través de la participación.</p>
                <form
                  className="gate-form"
                  id="gateForm"
                  onSubmit={(e) => {
                    e.preventDefault()
                    submitGate()
                  }}
                >
                  <div className="gate-field">
                    <label htmlFor="gateInput">Clave</label>
                    <input
                      type="password"
                      id="gateInput"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="···"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                  </div>
                  <div className={`gate-error${errorShown ? ' show' : ''}`} id="gateError">
                    CLAVE INCORRECTA
                  </div>
                  <button type="submit" className="gate-submit">
                    INGRESAR →
                  </button>
                </form>
              </div>
            </div>

            <div className="manifesto-content">
              <div className="manifesto">
                <div className="manifesto-vibe-bar" />

                <p>Todo tiene un centro.</p>
                <p>
                  Gradiente es infraestructura digital para la escena underground de música y arte sonoro
                  en México. Un foro descentralizado, inspirado en los message boards de los 90 y 2000, que
                  funciona como refugio y respuesta a la cultura del algoritmo.
                </p>
                <p>
                  Aquí conviven el listado curado de eventos, el periodismo musical, las reseñas, las opiniones,
                  los mixes, el foro y el marketplace. Todo bajo una misma lógica: el gusto subjetivo de cada
                  miembro es lo que mueve el sistema. La visibilidad se gana por aportación, no por performance.
                  Curaduría sin porteros.
                </p>

                <h3>LA MÚSICA ESTÁ MEJOR QUE NUNCA. LA INDUSTRIA ESTÁ ROTA.</h3>
                <p>
                  Hay más herramientas, más alcance, más géneros, mejores sistemas de sonido y músicos de
                  todas partes del mundo viajando y tocando. Existe una especie de aldea global. Pero todo
                  eso solo se premia si alimenta al algoritmo.
                </p>
                <p>
                  La mayoría de la juventud nunca vio los primeros días del rave, del grunge, del metal. No
                  eran virales. Eran contracultura: exactamente lo que después alimenta a la cultura
                  mainstream. Pero esa contracultura fue absorbida por las plataformas que hoy controlan cómo
                  nos enteramos de las cosas. Sin espacios descentralizados y abiertos, no podemos coincidir
                  en nada nuevo. Todas las ideas pasan primero por el filtro del algoritmo.
                </p>

                <h3>EL PROBLEMA ES EL CONTROL</h3>
                <p>
                  Tenemos las herramientas para ser independientes: distribuir, imprimir discos, promover. Aún
                  así, los músicos ganan menos que nunca. Los mismos cinco majors son los únicos que ganan
                  dinero. Los músicos no pueden vivir de la música. El medio está secuestrado.
                </p>
                <p>
                  Los festivales son caros y elitistas. La gente va por FOMO, no por descubrimiento. Las
                  plataformas donde vendemos, hablamos y escuchamos música son precisamente las más dañinas
                  para quienes la hacen y la escuchan. Está al revés.
                </p>

                <h3>NO HAY CLUBS. HAY DISCOTECAS.</h3>
                <p>
                  Los espacios donde pasaba la conexión son cada vez menores y menos auténticos, y no hay
                  reemplazos consistentes. Lo que queda son discotecas: espacios donde la música tiene que
                  adherirse a un formato alineado con los horarios de venta y consumo de bebidas. El DJ o la
                  banda es un servicio, no un artista. Un objeto de diseño, una planta, una curiosidad para
                  ambientar el lugar.
                </p>

                <h3>EL OUROBOROS DEL ALGORITMO</h3>
                <p>
                  Lo que queda digitalmente son plataformas que no fueron hechas para esto. Meta mata
                  cualquier interacción y solo busca controversia y perfiles performáticos. Spotify es un
                  demonio de mil cabezas que castiga la curiosidad y promueve cada vez más música hecha por
                  IA, completando su destino como la antítesis del consumo responsable de música.
                </p>
                <p>
                  Las recomendaciones se entrenan con recomendaciones, y las mismas cosas siguen apareciendo.
                  Lo local es inexistente y el contexto es nulo. Los jóvenes no tienen manera de establecer
                  una relación real con un álbum: simplemente usan la plataforma como un grifo que a su vez
                  les &quot;recomienda&quot; cosas similares.
                </p>
                <p>
                  Pero descubrir cosas más personales toma tiempo. Es llegar a tener una relación con algo,
                  no solamente usarlo como background. Son cosas que exigen algo de ti. Creemos que si vamos
                  a &quot;consumir&quot; música responsablemente, también deberíamos entrarle de otra manera, dentro
                  de un contexto, entregándole algo de nosotros, no solamente utilizándolo como ruido blanco
                  de fondo.
                </p>

                <h3>CUMPLIR CON LA PROMESA DE LA EDAD DORADA DE FOROS Y BLOGS</h3>
                <p>
                  Después del boom de los blogs, donde cada quien compartía desde su propio mundo y su propia
                  estética, nos volvimos una sociedad de medianía. Desaparecieron los extremos, las
                  excentricidades, los gustos raros. Desapareció también el periodismo musical hecho desde
                  adentro, escrito por gente de la escena para gente de la escena. Hoy lo mexicano nos llega
                  traducido: lo descubrimos cuando una plataforma de afuera nos lo devuelve filtrado. Todos
                  compartimos los mismos gustos porque no hay a dónde ir a indagar en algo profundo, nuevo
                  o misterioso.
                </p>
                <p>
                  Antes había multiplicidad de voces. Hoy el contenido y el formato se homogenizaron, y todo
                  tiene que ser inmediato, tiene que atraparte en medio de un scroll diseñado para secuestrar
                  tus sentidos. Que el algoritmo te muestre algo no es descubrimiento.
                </p>

                <h3>EL DESCUBRIMIENTO ES UN PRIVILEGIO</h3>
                <p>
                  Estamos desaprovechando los gustos subjetivos. Hoy el descubrimiento real está reservado
                  para quienes ya tienen contexto y acceso. La gente no sale de su clan: el algoritmo te
                  encierra en tu género, en tu nicho, en tu burbuja, y las generaciones y comunidades ya casi
                  no se cruzan.
                </p>
                <p>
                  Por eso necesitamos guías, no porteros. Gente que abra contexto en lugar de administrar el
                  acceso. Esas son las cosas que terminan cambiándote la vida.
                </p>

                <h3>LAS ETIQUETAS MIENTEN</h3>
                <p>
                  El género como único organizador es una mentira. Reduce lo que es continuo y separa lo que
                  naturalmente conversa entre sí. Hay techno que medita y techno que detona. Hay jazz de tres
                  de la mañana y jazz que es una pared de ruido. La etiqueta no te dice nada de eso.
                </p>

                <h3>GRAVEDAD, NO POLARIZACIÓN</h3>
                <p>
                  En el corazón del sistema hay un fader continuo de 0 (glacial) a 10 (volcán). Es la única
                  decisión que tomas para empezar a navegar. Mueves el fader y atraviesas todo a esa
                  intensidad, sin importar el género. Cada pieza nace con un valor asignado editorialmente,
                  y con el tiempo la comunidad lo refina con su lectura. A esto le llamamos calibración
                  analógica.
                </p>
                <p>
                  El fader convierte la jerarquización en un sistema análogo, promoviendo nichos naturales
                  en vez de polaridad algorítmica.
                </p>
                <p>
                  Entre el filtro local y el feedback análogo, se elimina la grasa de las plataformas
                  convencionales. Lo que queda es un entorno diseñado para leer, escribir y reflexionar.
                </p>

                <h3>LA OPORTUNIDAD</h3>
                <p>
                  El mundo se está reconstruyendo. Las estructuras que dimos por hechas se están desarmando,
                  y lo que viene después depende de qué cimientos pongamos hoy. Si no construimos algo
                  democrático ahora, alguna corporación lo va a construir por nosotros, y lo va a hacer mal.
                </p>

                <h3>DESDE AQUÍ</h3>
                <p>
                  Lo que pongamos, lo ponemos desde aquí. Gradiente nace en México, empezando por la CDMX,
                  y de ahí a GDL, GTO, Puebla, QRO, Monterrey, con la mira puesta en Latinoamérica. Las
                  plataformas que hoy moldean cómo descubrimos y cómo escuchamos fueron construidas desde
                  otros centros culturales. Son referentes eurocéntricos que pretenden ser globales. Nosotros
                  no necesitamos traducción. Por locales, para todo el mundo.
                </p>
                <p>
                  La infraestructura tiene que construirse desde adentro de la escena, no impuesta desde
                  afuera. Comunidad, democratización, decolonización.
                </p>

                <h3>LA ENERGÍA DE LOS MESSAGE BOARDS</h3>
                <p>
                  Volvemos a algo viejo y bueno: la energía de los message boards de los 2000s. Lugares sin
                  censura algorítmica, sin necesidad de performar, donde la conversación tenía peso porque
                  importaba la idea, no el rendimiento. Tomamos esa raíz y la traemos al presente con
                  tecnología real: un sistema profundamente técnico por dentro, pero intuitivo e inmediato
                  para todos. La tecnología opera por debajo, como una corriente subterránea, sin
                  protagonismo. El medio debería ser invisible. Es infraestructura para que la escena conviva
                  y comparta. Nada más.
                </p>

                <h3>ESPACIO COLECTIVO</h3>
                <p>
                  Aquí cada sello, tienda, promotora, colectivo y espacio tiene perfil propio. Linkeas
                  directo a tu tienda, conectas con un público especializado, y tienes el contexto para
                  escribir reseñas o subir mixes desde adentro de tu proyecto.
                </p>
                <p>
                  Cada partner tiene su equipo de admins y miembros que pueden publicar desde el espacio. Y
                  si abres tus foros al público, puedes forjar alianzas, sumar gente de tu comunidad, dejar
                  que el círculo cercano aporte sin necesariamente formar parte del equipo.
                </p>

                <h3>SIN IA. SIN PERFORMANCE.</h3>
                <p>Sin texto generado por IA, sin música generada por IA. Personas reales, conversación real.</p>
                <p>
                  Queremos que la gente escriba, piense, haga listas, pregunte. No nos importa qué tan bien
                  escribas. Importa que pienses, que tengas curiosidad, que aportes algo desde tu propio
                  lugar.
                </p>

                <h3>GUÍAS, NO PORTEROS</h3>
                <p>
                  Hoy se ha perdido el gatekeeping, y eso es bueno. Pero tampoco podemos consumir todo lo que
                  existe; necesitamos encontrar nuestro nicho, y para eso siempre ha hecho falta un guía. Las
                  redes sociales los limaron hasta hacerlos casi imperceptibles. Al enfocarnos en menos
                  cosas, podemos volver a construir nichos y comunidades integradas.
                </p>
                <p>
                  Una comunidad no es simplemente un grupo de personas a las que venderles cosas. Es un
                  organismo vivo con distintos matices, diferentes niveles de participación y diversas fases
                  de involucramiento. Algunos están ahí para crear e influir en la experiencia. Otros para
                  observar desde la sombra. Ambas posturas son válidas e incluso necesarias.
                </p>
                <p>
                  La pertenencia y el nivel de acceso se ganan por aportación. El sistema lo lee solo: según
                  las reacciones que provocas en los comentarios, señal (!) o duda (?), vas cayendo en un
                  rango. DETONADOR si lo que escribes prende. ENIGMA si abre preguntas. ESPECTRO si haces las
                  dos cosas. Hasta entonces eres NORMIE, como todos.
                </p>

                <h3>VIDA ORGÁNICA DEL CONTENIDO</h3>
                <p>
                  Cada cosa que entra a Gradiente tiene vida. No vive para siempre arriba ni se entierra al
                  día siguiente. Cada pieza nace con HL: una energía que decae con el tiempo y se renueva con
                  la atención de la comunidad. Lo que se calibra, se comenta, se comparte: vive más. Lo que
                  nadie toca, se hunde por su propio peso.
                </p>
                <p>
                  HL se comporta distinto según lo que sostiene. Una reseña no decae a la misma velocidad
                  que un evento, un mix no se mide igual que una opinión, un post de foro vive en otro tiempo
                  que un editorial. Cada contenido ocupa un lugar democratizado, pero ese lugar siempre es
                  contextual.
                </p>
                <p>
                  No hay likes, no hay dislikes, no hay contadores de seguidores, no hay estrellas. Tamaño y
                  posición son las únicas señales visibles. La curaduría es el peso, y el peso se ve
                  directamente.
                </p>

                <h3>LA ECONOMÍA DE LA ESCENA</h3>
                <p>
                  La gente que mantiene esto vivo debería ganar algo: escritores, curadores, constructores de
                  comunidad. La página no tiene costos para quien la usa, pero HL está diseñado para
                  evolucionar hacia un mecanismo de intercambio monetario, junto con un sistema integrado de
                  tipping. Los puntos que genera cada creador serán canjeables, y la comunidad podrá apoyar
                  directamente a quien le mueve algo.
                </p>
                <p>
                  A corto plazo: convocatorias mensuales. Los tres posts con más HL ganan dinero. Sin jurado.
                  La comunidad decide.
                </p>

                <p className="closing-line">
                  Esto es infraestructura que la escena posee, antes de que alguien más la construya y la
                  posea por nosotros.
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="group">
            <span className="sys-dot" aria-hidden="true" />
            <span className="unit">GRADIENTE</span>
            <span className="sep">·</span>
            <span>BETA 150</span>
            <span className="sep">·</span>
            <span>CDMX 2026</span>
          </div>
          <div className="group">
            <span>ACCESO RESTRINGIDO</span>
            <span className="sep">·</span>
            <span>NO DISTRIBUIR</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
