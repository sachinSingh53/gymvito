# Liquid Glass Design Rollout Plan

| Field                  | Value                                                                           |
| ---------------------- | ------------------------------------------------------------------------------- |
| Status                 | Draft                                                                           |
| Date                   | 2026-10-17                                                                      |
| Pilot                  | Dashboard (`src/app/(app)/home.tsx`) and Unlock (`src/app/(public)/unlock.tsx`) |
| Target                 | Every screen in the app, phone and tablet, English and Hindi                    |
| Visual source of truth | `docs/design/DESIGN.md` (colour tokens) and this document (glass rules)         |

---

## 1. Goal

Replace the current flat "Evergreen" surfaces with the liquid glass look from the
dashboard pilot across the whole app. The redesign must keep every screen as legible,
accessible and fast as it is now.

This is a visual change only. No behaviour, data, navigation route or translation key is
added or removed. The feature specification and implementation plan stay unchanged.

## 2. Where we are today

### 2.1 What already exists

| Piece                    | Location                                  | Notes                                                                                                            |
| ------------------------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `GlassSurface`           | `src/ui/components/glass-surface.tsx`     | Blurred, tinted panel with rim and sheen. Real blur on iOS, and on Android only when it is given a `blurTarget`. |
| `GlassSheen`             | same                                      | Thin specular rim for small bubbles. It replaced the old top-half band, which made solid buttons look two-tone.  |
| `GlassBackdrop`          | same                                      | The soft colour blobs the glass sits on.                                                                         |
| `glass` fills and rims   | same                                      | `fill`, `fillMint`, `fillPrimary`, `fillAccent`, `rimAccent`, and others.                                        |
| `OperationalShell glass` | `src/ui/components/operational-shell.tsx` | Floating blurred header over a backdrop. Only `home` turns it on.                                                |

### 2.2 What still uses the old design

- **18 business screens** use `OperationalShell`. Only the dashboard passes `glass`.
- **7 setup and public screens** use `AppScreen`, which has no glass mode at all.
- **Shared controls are still flat:** `SurfaceCard`, `StatusChip`, `LocalDataBadge`
  (operational-shell) and `AppButton`, `AppField`, `AppChoice`, `AppCheckbox`, `Notice`,
  `LoadingState` (core-controls). Between them they are used on almost every screen.
- **Bottom navigation and the tablet side rail are solid bars.** They live in
  `src/app/(app)/_layout.tsx`, outside any blur target.
- **Hard-coded colours** remain in `members.tsx`, `member-card.tsx`, `payment-form.tsx`
  and `plan-form.tsx`.

### 2.3 Lessons from the pilot

These problems showed up on a real Android device. Each one becomes a rule in §3.

1. **Android cannot blur content that sits inside the scrolling page.** expo-blur can only
   blur a view that is a sibling of the blur target, not an ancestor. In-page cards
   therefore get no blur, just a translucent tint. At 55% white, the backdrop blobs showed
   through behind the text and made it hard to read.
2. **No blur at all below Android 12 (API 31).** The app's `minSdkVersion` is 28, so
   devices on Android 9–11 always get the tint-only fallback.
3. **A white band over half a solid button splits it into two tones.** Highlights must be
   thin rims, never fills.
4. **White buttons on white glass disappear.** Secondary controls need a brand-tinted fill
   and border to show where they start and end.
5. **Three equal-width pill buttons truncate their labels**, especially in Hindi.
   Stacked icon-over-label tiles fit reliably.

## 3. Design rules

Every screen in the rollout must follow these rules. Reviewers check against this list.

### 3.1 Layers

| Layer              | What goes there                               | How it is drawn                                                       |
| ------------------ | --------------------------------------------- | --------------------------------------------------------------------- |
| 0. Backdrop        | `GlassBackdrop` colour blobs                  | Once per screen tree, behind everything                               |
| 1. Floating chrome | Header, bottom nav, side rail, sticky footers | `GlassSurface` with `blurTarget`, so it gets real blur on Android 12+ |
| 2. Content panels  | Cards, lists, forms, banners                  | `GlassSurface` without `blurTarget` (dense frost, see §3.2)           |
| 3. Controls        | Buttons, chips, fields, toggles               | Solid or brand-tinted fills. No blur.                                 |

Glass is for **surfaces**, not for **controls**. A button never blurs.

### 3.2 Legibility

- Content panels use the frost values in `GlassSurface`: 62% white on iOS and 86% white
  on Android without blur. Do not lower them per screen. If a screen needs a warm or mint
  wash, pass `tint` at **≥ 0.85 alpha**.
- Text contrast must meet WCAG 2.2 AA (4.5:1 for body text, 3:1 for text ≥ 18pt). Measure
  it against the _worst case_: the frost composited over the most saturated backdrop blob.
- Never put body text directly on the backdrop. Section titles may sit there if they use
  `colors.text` and are 14pt bold or larger.
- Respect the system "reduce transparency" setting where the platform exposes it
  (`AccessibilityInfo.isReduceTransparencyEnabled`, iOS only). When it is on, use opaque
  surfaces.

### 3.3 Controls

| Control                          | Fill                     | Border                                         | Text and icon                 |
| -------------------------------- | ------------------------ | ---------------------------------------------- | ----------------------------- |
| Primary button                   | `colors.primary` (solid) | none                                           | `#fff`                        |
| Danger button                    | `colors.danger` (solid)  | none                                           | `#fff`                        |
| Secondary button and link button | `glass.fillAccent`       | `glass.rimAccent`                              | `colors.primaryDark`          |
| Icon bubble                      | `glass.fillAccent`       | `glass.rimAccent`                              | `colors.primaryDark`          |
| Brand bubble (logo, avatar)      | solid brand colour       | `glass.rimSoft`                                | `#fff`, with `GlassSheen` rim |
| Status chip                      | tone surface ≥ 0.8 alpha | tone border                                    | tone text, **≥ 10pt**         |
| Text field                       | `rgba(255,255,255,0.9)`  | `glass.rimAccent`, `colors.focus` when focused | `colors.text`                 |

- Touch targets stay at least 48dp. A compact in-card action may be 44dp tall only if the
  card itself is also tappable.
- Pressed state: `opacity 0.72` and `scale 0.98`. This is already `actionPressed` on the
  dashboard and becomes a shared style.
- Button labels are single-line, with `adjustsFontSizeToFit` at `minimumFontScale 0.8`.
  When three or more actions share a row, use the stacked tile layout.

### 3.4 Shape and spacing

- Panels: radius 24 (`CARD_RADIUS`). Floating chrome: radius 28 (`GLASS_RADIUS`).
  Controls: pill shape.
- Spacing between panels: 12. Panel padding: 16. Dividers inside panels:
  `rgba(13,102,89,0.12)`, not white.

## 4. Architecture changes

### 4.1 Move glass tokens into the theme

Move `glass`, `GLASS_RADIUS`, `CARD_RADIUS`, the frost alphas and the backup tints into
`src/ui/theme/tokens.ts` under a `glass` export. Screens then import colours from one
place, and the hard-coded `rgba(...)` values in screens can be replaced.

### 4.2 One backdrop and blur target per navigator

Today each glass screen creates its own `BlurTargetView` and `GlassBackdrop`. The rollout
moves both into `src/app/(app)/_layout.tsx`:

```
<View root>
  <BlurTargetView ref={blurTargetRef}>   ← GlassBackdrop + <Stack/>
  <GlassHeader/>                         ← portal or per-screen; blurs over the Stack
  <GlassBusinessNavigation blurTarget/>  ← bottom bar / side rail, now real glass
</View>
```

- Expose `blurTargetRef` through a small `GlassContext` so `OperationalShell` headers and
  sticky footers can blur without each screen managing a ref.
- `AppScreen` gets the same treatment in `(setup)/_layout.tsx` and `(public)` (unlock
  already does this inline; refactor it onto the shared context).
- Content must scroll _under_ the floating nav. Pad content by the nav height and keep the
  nav translucent so the frost shows content behind it.

### 4.3 Shared component upgrades

Restyle these in place. Their props and behaviour stay the same, so call sites do not
change:

| Component                   | Change                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `SurfaceCard`               | Render `GlassSurface` with `CARD_RADIUS`                                                                                  |
| `StatusChip`                | Glass chip spec (§3.3), font size ≥ 10                                                                                    |
| `LocalDataBadge`            | Glass chip spec                                                                                                           |
| `AppButton`                 | Primary and danger variants solid. Secondary and danger-tonal variants use the accent fill and rim. Shared pressed style. |
| `AppField`                  | Near-opaque white fill, accent rim, focus ring                                                                            |
| `AppChoice` / `AppCheckbox` | Accent fill when unselected, solid primary when selected                                                                  |
| `Notice`                    | `GlassSurface` with a warning or danger tint at ≥ 0.85 alpha                                                              |
| `LoadingState`              | Centred inside a glass panel                                                                                              |

New shared pieces, extracted from `home.tsx` so other screens can reuse them:

- `GlassIconButton`: the eye and lock buttons.
- `ActionTile`: the stacked quick-action tile (`CounterAction`).
- `GlassListRow`: avatar, title, meta, trailing chip and trailing action. Generalised from
  `UrgentTaskCard` for the member and payment lists.

Most screens are built from these components, so this step alone changes most of the app.
The screen waves in §5 then handle each screen's own custom styling.

### 4.4 Kill switch

Add `GLASS_UI` (a boolean in `src/ui/theme/tokens.ts`) that the shells, `SurfaceCard` and
core controls read. When it is `false`, everything renders the current flat styles. This
keeps a one-line rollback available until the cleanup phase. The app has no remote config,
so it is a build-time switch. A hotfix build flips it if needed.

## 5. Rollout phases

Each phase merges to `main` on its own, ships in a preview APK
(`pnpm build:android:preview`) and must pass its exit gate before the next phase starts.

### Phase G0: Foundations (no visible change)

- Move tokens into `tokens.ts` (§4.1), add the `GLASS_UI` switch, add `GlassContext`.
- Add shared `actionPressed` and contrast helper tests.
- **Exit gate:** `pnpm validate` passes, and screens are unchanged with `GLASS_UI=false`.

### Phase G1: Shell and navigation

- Move the backdrop and blur target into `(app)/_layout.tsx` (§4.2).
- Make glass the default chrome in `OperationalShell`, and remove the `glass` prop from
  `home.tsx`.
- Restyle the bottom navigation and the tablet side rail as floating glass.
- Add a glass mode to `AppScreen` and to the setup and public layouts.
- **Exit gate:** header and nav blur on an Android 12+ device, look acceptable without blur
  on an Android 9–11 device, and scrolling stays smooth (see §6).

### Phase G2: Shared components

- Upgrade every component in §4.3 and extract `GlassIconButton`, `ActionTile` and
  `GlassListRow`.
- Update `core-controls.test.tsx` and `operational-shell.test.tsx` for the new styles while
  keeping the 48dp and accessibility assertions.
- **Exit gate:** every screen is still usable and legible in its new mixed state. Do a
  screenshot pass of all 25 screens.

### Phase G3: Screen waves

Migrate the custom styles left in each screen: remove hard-coded colours, switch to the
shared glass pieces and fix layout issues such as truncation and empty space. The waves go
in order of daily front-desk use.

| Wave                     | Screens                                                                                           | Route and feature files                                                                                                                                                                                                           | Notes                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| A: Daily desk            | Members list, Member profile, Payments, Invoice, Record payment, Renew membership                 | `members.tsx`, `member/[memberId]/*`, `payments.tsx`, `invoice/[invoiceId].tsx`, `features/members/member-card.tsx`, `member-profile-panel.tsx`, `features/payments/payment-form.tsx`, `features/memberships/membership-form.tsx` | Heaviest screens. `member-card` and `members` hold most of the hard-coded colours. The search field becomes a glass field. |
| B: Catalogue and records | Plans, Plan form, New and edit member, Reports                                                    | `plans.tsx`, `plan/*`, `features/plans/plan-form.tsx`, `features/members/member-form.tsx`, `reports.tsx`                                                                                                                          | Long forms: check keyboard avoidance with the floating nav.                                                                |
| C: Admin                 | More, Settings, Gym settings, Billing settings, Backup and restore, Data export, Help and privacy | `more.tsx`, `settings.tsx`, `gym-settings.tsx`, `billing-settings.tsx`, `backup-restore.tsx`, `data-export.tsx`, `help-privacy.tsx`                                                                                               | `settings` and `gym-settings` move from `AppScreen` to glass `AppScreen`.                                                  |
| D: First run and access  | Language, Gym setup, Security, Backup intro, Recovery, Unlock (refactor only)                     | `(public)/language.tsx`, `(setup)/*`, `(public)/recovery.tsx`, `(public)/unlock.tsx`                                                                                                                                              | Unlock is already glass. Move it onto `GlassContext` and shared pieces.                                                    |

Each wave's exit gate:

- [ ] No hard-coded hex or `rgba` colours left in the wave's files (except in tests).
- [ ] Phone and tablet screenshots in English and Hindi are added to
      `docs/design/screens/<screen>_glass/`.
- [ ] Font scale 1.3: no clipped labels and no overlap.
- [ ] Contrast check passes for every text style on the screen (§3.2).
- [ ] Unit tests for the wave's features pass, and `pnpm validate` is green.

### Phase G4: Cleanup

- Remove the `GLASS_UI` switch and the flat-style branches.
- Delete the unused flat styles in `operational-shell.tsx` and `core-controls.tsx`.
- Update `docs/design/DESIGN.md` with a glass section that points to §3. Mark this plan
  _Complete_.
- **Exit gate:** no references to the old surfaces remain, and the production build has
  been checked on devices.

## 6. Quality checks

### 6.1 Device matrix

| Device class                   | Why                                               |
| ------------------------------ | ------------------------------------------------- |
| Android 9–11 phone (API 28–30) | No blur. Tint-only fallback must still read well. |
| Android 12+ mid-range phone    | Real blur. Check scrolling performance.           |
| Android tablet (≥ 600dp)       | Side rail and two-column layouts                  |
| iOS phone (if built)           | Native blur and the reduce-transparency setting   |

### 6.2 Performance budget

- Blur views are expensive on Android. Allow no more than **3 blurred views on screen at
  once** (header, nav, and one sticky footer). Content panels never blur.
- Scrolling the members list (200 members) must stay at ≥ 55 fps on the mid-range device.
  Check with the Perf Monitor in the development build.
- Cold start must not regress by more than 100 ms compared with the pre-rollout build.

### 6.3 Accessibility

- TalkBack labels must be unchanged. The rollout must not touch any `accessibility*` prop
  except to add missing ones.
- Touch targets ≥ 48dp, verified by the existing tests.
- Hindi (Devanagari) text needs extra line height. Check that chips and tiles do not clip
  the vowel signs that sit above or below the letters.

## 7. Risks

| Risk                                                           | Mitigation                                                                                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Content becomes illegible over the backdrop on low-end Android | Dense frost values are locked in `GlassSurface`, and the worst-case contrast check is part of each wave's exit gate |
| Blur hurts scrolling performance                               | Blur only on chrome (§6.2). Profile in G1 before anything else depends on it.                                       |
| A shared-component restyle breaks a screen nobody looks at     | Screenshot pass of all 25 screens in G2                                                                             |
| `expo-blur` `blurTarget` API changes in an SDK upgrade         | Blur use stays inside `GlassSurface` and `GlassContext`                                                             |
| A bad visual regression reaches gym owners                     | The `GLASS_UI` kill switch stays in place until G4                                                                  |

## 8. Tracking

| Phase                       | Owner | Status      |
| --------------------------- | ----- | ----------- |
| Pilot: Dashboard and Unlock | —     | Done        |
| G0 Foundations              | —     | Done        |
| G1 Shell and navigation     | —     | Done        |
| G2 Shared components        | —     | Done        |
| G3-A Daily desk             | —     | Done        |
| G3-B Catalogue and records  | —     | Not started |
| G3-C Admin                  | —     | Not started |
| G3-D First run and access   | —     | Not started |
| G4 Cleanup                  | —     | Not started |
