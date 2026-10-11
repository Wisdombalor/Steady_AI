# Steady design review

The design-orchestrator selected frontend design, responsive web app, Emil interaction guidance, Mobbin UI research, and React performance guidance for this pass. The existing Fraunces/Figtree typography, recovery flows and visual identity are preserved.

## Research

Three focused Mobbin searches studied dashboards, signup validation and side-panel forms:

- [Perplexity](https://mobbin.com/screens/e879169d-0e6e-4105-91df-1befa935e6dc): persistent navigation and separation of summary information from the next action.
- [Clerk](https://mobbin.com/screens/2113333c-e3e0-47e6-a8b2-4ba3497a334f): a focused form with validation and secondary account navigation.
- [Klook](https://mobbin.com/screens/32e798f9-569c-40d6-be50-585293c37c70): a side panel with an obvious close control and clear form actions.

These informed hierarchy and interaction patterns; their branding and artwork were not copied.

## Changes

- Group recovery progress and daily check-in, distinguish urgent support from routine actions, and add short explanations for support shortcuts.
- Retain labeled bottom navigation on phones, add a tablet navigation rail and a branded desktop sidebar.
- Use native modal dialogs with background inertness, accessible names, explicit Tab wrapping, Escape dismissal, visible close controls and focus restoration.
- Support Enter submission in onboarding, recovery setup and account forms. Keep password visibility keyboard accessible and announce validation messages.
- Keep currency and amount fields in a constrained grid. Clear incomplete date values, clamp days when changing months and reject future recovery dates.
- Prevent long strings and grid items from widening the page; improve metadata size and the dark-mode urgent-action contrast.
- Remove the repeating urgent-button pulse; ensure welcome content and its checkmark remain visible under reduced motion.
- Label Beacon chat and its composer, announce conversation updates and disable sending an empty message.
- Load admin tools only when their route is visited.
- Preserve existing local profile and sign-out edits. Clarify how account sync affects the privacy description.
- Stop tracking generated build HTML and Finder metadata; keep local files on disk.

## Validation

- Production build (`npm run build`) and whitespace checks (`git diff --check`).
- Browser guest onboarding through recovery setup and home.
- All five main views at 320px: no page or main-content horizontal overflow.
- Home at 390px and 768px; tablet navigation rail and responsive content verified.
- Dialog Shift+Tab/Tab wrapping, Escape dismissal and focus restoration to Check in.
- Empty login submitted with Enter displays validation; keyboard password toggle works.
- Clearing a date part prevents save; January 31 changing to February clamps to February 28; future dates are rejected.

Signed-in account sync, Google OAuth, moderation permissions, real AI replies and outbound reports require their live backend/account configuration and were not exercised by this UI pass. No external reports or test posts were submitted.
