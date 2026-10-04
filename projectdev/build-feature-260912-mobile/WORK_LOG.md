# Android mobile frontend

`[projectdev] mode: orchestrator` — classified by the bundled router as build-feature.
Authorized scope: responsive frontend for mobile HTML loading, preserving game rules and existing expansion work. Terminal: local verification; no deployment.

Success predicate: `npm test` and `npm run test:browser` exit 0, plus screenshot inspection for phone layouts. Browser command passed the skill command screen. Existing logic tests supplied the baseline.

1. Inspected entry redirect, fixed-width sliders, shared resources, event overlays and swipe handlers. Implemented a scoped presentation adapter, viewport metadata, responsive CSS and a central active-module presentation hook.
2. Touch tests exposed CSS specificity collapsing the flight stage and the decorative star layer intercepting input. Fixed stage sizing and pointer hit testing, then verified held movement and cancellation using actual CDP touch input. Corrected a fixture that skipped initial ship thrusters.
3. Added safe-area layout, native language selection, visible recipe costs, larger quantity controls, touch-safe dialogs, dark flight controls, ending layout and cleanup. Corrected the import test to pass through its existing confirmation scene before editing text.
4. Full suite passed: 12 Node tests, content validation, 13 browser cases (7 existing desktop, 6 mobile). Added visualViewport handling for Android keyboards which do not resize the layout viewport; all 6 affected mobile cases passed again, including a separate visual-viewport shrink/pan check.
5. Inspected room, save dialog, landscape outfit and light/dark flight screenshots. Added `doc/mobile-frontend.md` and linked it from README. Whitespace validation passed.

Limits: browser emulation used Edge/Chromium with Android user agent, touch events and 320/360px portrait plus 800px landscape viewports. No physical Android device or embedded WebView run was available. Original gameplay coordinate systems and save format are unchanged.
