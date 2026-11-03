# Live waves during scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal** Keep visible waves alive during chapter reveals and preserve hidden waves.

**Architecture** The chapter controller sends exposure changes to the existing
WebGL renderer. Rendering pauses with fields resident and its activity deadline
shifted on resume. A small tap recognizer shares the pointer input module.

**Tech Stack** Vanilla JavaScript, WebGL 2, CSS scroll timelines, existing Lenis.

**Spec** docs/superpowers/specs/2026-11-04-live-waves-design.md

## Global Constraints

- Mouse movement alone creates new desktop waves. Scrolling introduces no impulses.
- Retain GPU fields while hidden and resume with the remaining decay time.
- A completed phone tap emits once. A swipe retains native scrolling.
- Reuse the current reveal geometry and keep the standalone builder working.

## Review Focus

- Chapter opacity and clipping have different endpoints. Pause at full clipping.
- A hidden period exceeding 6.5 s must not expire the retained trace on resume.
- Pointer input collected before hiding must not connect to a new cursor position.
- A swipe that returns near its origin still must not become a tap.
- Async renderer boot and direct section links must initialize exposure correctly.

## Task 1. Renderer, exposure and tap input

Files are dist/app.js, dist/scroll-text.js, dist/jet-input.js,
scripts/fluid-lifecycle.test.mjs, scripts/touch-tap.test.mjs,
scripts/hero-exposure.test.mjs, and scripts/build-standalone.py.

Interfaces are options.onHeroVisibility(visible), FluidReveal.updateVisibility(),
and TouchTap.begin(event, scrollY), move(event, scrollY), end(event, scrollY), cancel().

- [x] Add focused regression tests and observe failures against the current renderer.
- [x] Calculate the exposure endpoint after measurement and notify on changes only.
- [x] Combine chapter, intersection, and document visibility in updateVisibility().
- [x] Shift lastInput by the paused interval, reset lastTime, and retain GPU fields.
- [x] Remove the scrollY simulation gate and recognize touch taps on pointerup only.
- [x] Update cache keys, tap instructions, and standalone import stripping.
- [x] Run node --test scripts/*.test.mjs and rebuild the standalone HTML.

## Task 2. Browser verification and publication

- [x] In a temporary browser harness verify live GPU mass during partial scroll.
- [x] Verify identical density while fully hidden and resumption after 7 s.
- [x] Check stationary mouse scroll adds no input, phone tap emits, swipe does not.
- [x] Check desktop/mobile layouts and standalone boot without console errors.
- [ ] Review the whole change, update the ZIP and standalone output, and publish
      to the already-authorized repository with an expected-head lease.
- [ ] Verify successful Pages deployment and the live version.

## Execution record

The current workspace is the existing isolated extracted checkout. GitHub is
updated through its connector. Implementation runs inline under the existing
user authorization, with one final independent code review.


Verification record on 2026-11-04

All 22 Node tests pass. Desktop WebGL QA passed, including a 7.1-second hidden
interval with identical density and resumed activity. Independent review found
and verified fixes for pointer-coordinate rebasing and focus modality changes.
The temporary QA harness and server live outside the repository package.
