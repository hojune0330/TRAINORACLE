# Task 06 Evidence - Isolated Projection Prototype

## Scope

- Static files only: `prototypes/formation-projection/`.
- Synthetic data only; no network, persistence, generator, plan mutation, or production route.
- Browser verifier only: `prototypes/formation-projection/browser-verify.mjs`.
- `projection_accepted:false`; named athlete/coach/privacy/accessibility reviews remain absent.

## RED

`node prototypes/formation-projection/verify.mjs` failed with `ENOENT` for the missing
`index.html` before the prototype existed.

The first bounded Playwright run also exposed a test-driver defect: direct `check()` on
the visually hidden radio retried until timeout because the visible label intercepted
the pointer. The test was changed to click the same visible label a user clicks and then
assert the radio state.

## GREEN

```text
PASS Formation projection static contract
PASS Formation projection browser contract levels=5 audiences=4 states=8 viewports=4 network=0
```

The browser verifier proves:

- five explanation levels change copy while fact and real-plan hashes remain unchanged;
- all eight status states announce their distinct fail-closed meaning;
- all four audiences enforce their surface boundary, including no Formation projection
  for journal-only and permitted-summary-only guardian view;
- no external network request occurs and human review stays disabled;
- 320x700, 375x667, and 1440x900 have no horizontal overflow;
- 200 percent zoom retains visible focus and readable stacked content;
- reduced-motion mode removes the status animation;
- visible controls meet 44x44 CSS pixels, major bands do not overlap, representative
  text reaches 4.5:1 contrast, and keyboard focus reaches the control groups;
- cookies and browser storage remain empty.

## Render Evidence

- `runtime-evidence/formation-projection/mobile-320.png`
- `runtime-evidence/formation-projection/mobile-375.png`
- `runtime-evidence/formation-projection/desktop.png`
- `runtime-evidence/formation-projection/zoom-200-reduced-motion.png`

All four images were visually inspected. The 200 percent layout was revised once to
stack the status and composite components, then recaptured and inspected again.

## Non-Claims

Automated keyboard, viewport, motion, and rendering checks are not assistive-technology
testing, accessibility certification, participant feedback, privacy approval, or runtime
evidence. The prototype contains no Formation execution authority.
