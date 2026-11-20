---
name: elastic-motion
description: Ahmad's quiet elastic micro-interaction style for web UIs (spring overshoot on press, value bumps, badges, toggles, modals, tabs, empty states). Use when the user asks for elastic / bouncy / spring / "حركات elastic" / micro-interactions / making a site feel alive, or to apply the Memoria motion style to another project.
---

# Elastic Motion

Barely noticeable, refined spring motion. Full reference with copy-paste CSS, springs table, React patterns and checklist: `references/guide.md` — read it before implementing.

## Hard rules
- Simple only: one small motion per event. Overshoot 2–8%.
- Mouse stays normal: no cursor-follow, hover tilt, magnetic buttons, custom cursor.
- No dated trends: no stars/sparkles, glitch, typewriter, 3D flip, heavy parallax, dense confetti.
- Motion answers a user action or a value change; never loops on its own.
- Elastic on position/scale only; opacity and color always plain ease.
- Big things (sections, pages) get soft springs (stiffness ~110, damping ~19), small things stiffer.
- Every effect has a `prefers-reduced-motion` override.
- Use separate `scale` / `translate` CSS properties, unlayered (wins over Tailwind layers). RTL via `--dir`.

## Core curve
`cubic-bezier(0.34, 1.56, 0.64, 1)` (soft: `0.34, 1.3, 0.64, 1`; shrink-out: `0.36, 0, 0.66, -0.56`).

## Workflow
1. Read `references/guide.md`.
2. Survey the project: buttons, badges, counters, switches, dialogs/menus, tabs, empty states, errors, search, calendar, uploads.
3. Propose a short list (≤12) from the guide's checklist; implement on yes.
4. Add the CSS block once to the global stylesheet; reuse classes (`elastic-press`, `elastic-bump`, `elastic-dot`, `elastic-modal`, `settle-in`, `rise-in`…). Re-key (`key={value}`) to replay on change.
5. Verify in a foreground browser window (background tabs throttle rAF to 1–4 fps): sample `getComputedStyle(el).scale` per frame; target ≥60 fps, max frame gap <25 ms, curve overshoots then settles. Check RTL, LTR and reduced motion.
