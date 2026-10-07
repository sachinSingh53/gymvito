# GymVito UI Design Reference

## Approved design

- Stitch project: https://stitch.withgoogle.com/projects/15945929754266747357
- Last reviewed: 2026-10-07
- Target: Android phone and tablet
- Status: Approved design reference

## Source of truth

- Product behavior: `docs/FEATURE_SPECIFICATION.md`
- Implementation phases: `docs/IMPLEMENTATION_PLAN.md`
- Visual design: `docs/design/DESIGN.md`
- Approved screen snapshots: `docs/design/screens/`

If the live Stitch design differs from the screenshots, the committed
screenshots and DESIGN.md represent the reviewed version.

## Implementation notes

- Implement using React Native and Expo components.
- Do not copy generated HTML/CSS directly into the application.
- Map design tokens into `src/ui/theme/tokens.ts`.
- Preserve English and Hindi layouts.
- Support Android phone and tablet layouts.
- Maintain WCAG 2.2 AA contrast and minimum 48px touch targets.
- Do not introduce cloud login, synchronization, attendance, online payment
  processing, or a gym timezone selector.
