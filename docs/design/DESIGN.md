---
name: Evergreen Operational Engine
colors:
  surface: '#e5fff8'
  surface-dim: '#c6e0d9'
  surface-bright: '#e5fff8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#dff9f3'
  surface-container: '#d9f3ed'
  surface-container-high: '#d4eee7'
  surface-container-highest: '#cee8e1'
  on-surface: '#071f1c'
  on-surface-variant: '#3f4946'
  inverse-surface: '#1e3530'
  inverse-on-surface: '#dcf6f0'
  outline: '#6f7976'
  outline-variant: '#bec9c5'
  surface-tint: '#156a5d'
  primary: '#004c42'
  on-primary: '#ffffff'
  primary-container: '#0d6659'
  on-primary-container: '#95e1d0'
  inverse-primary: '#89d5c4'
  secondary: '#4f625f'
  on-secondary: '#ffffff'
  secondary-container: '#cfe4e0'
  on-secondary-container: '#536664'
  tertiary: '#49432d'
  on-tertiary: '#ffffff'
  tertiary-container: '#615a43'
  on-tertiary-container: '#dcd2b5'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#a5f1e0'
  primary-fixed-dim: '#89d5c4'
  on-primary-fixed: '#00201b'
  on-primary-fixed-variant: '#005046'
  secondary-fixed: '#d2e7e3'
  secondary-fixed-dim: '#b6cbc7'
  on-secondary-fixed: '#0c1f1d'
  on-secondary-fixed-variant: '#374a48'
  tertiary-fixed: '#ede2c5'
  tertiary-fixed-dim: '#d0c6aa'
  on-tertiary-fixed: '#201b09'
  on-tertiary-fixed-variant: '#4d4731'
  background: '#e5fff8'
  on-background: '#071f1c'
  surface-variant: '#cee8e1'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
  title-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-sm:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 16px
  gutter-tablet: 24px
  margin: 16px
  margin-tablet: 24px
  margin-desktop: 32px
  space-xs: 4px
  space-sm: 8px
  space-md: 16px
  space-lg: 24px
  space-xl: 32px
---

## Brand & Style

This design system is tailored for fast-paced, high-stress gym operations in Tier 1 to Tier 3 Indian cities. Front-desk staff, managers, and trainers balance foot traffic, check-ins, cash collections, and walk-in trials while managing poor network connectivity. The interface prioritizes calm authority, extreme legibility under harsh counter lighting, and immediate comprehension with zero training overhead.

The visual direction combines **Material 3 architectural ergonomics** with an **authoritative, local-first operational palette**:

- **Trust & Permanence:** Deep evergreen anchoring replaces standard sterile corporate blues with dependable, grounded bio-architectural tones.
- **Glanceable Speed:** Dense, actionable data hierarchy ensures front-desk operators can log payments, inspect memberships, and confirm access in under 2 taps.
- **Offline Dignity:** Explicit device-state indicators (local database sync badges, offline caches) provide visual guarantees that business records are safe without internet.
- **Zero Ambiguity Ergonomics:** High touch tolerances (minimum 48dp targets), stark status contrast, and dedicated dual-script typography ensure seamless bilingual Latin-Devanagari workflows.

## Colors

The palette is engineered around high functional contrast, clear state transitions, and low eye fatigue during long desk shifts.

### Palette Architecture

- **Brand & Header Root (`#071A18`):** Deep evergreen foundation used across the Android system bar, app headers, modal title bars, and bottom navigation anchors.
- **Primary Interactive (`#0D6659`):** Confident teal-green reserved for primary call-to-actions, focused strokes, active tabs, and primary controls.
- **Pressed Interactive State (`#084B42`):** Direct tactile state change for active touches and pressed buttons.
- **Base Canvas (`#F4FBF8`):** Ultra-soft mint-tinted off-white reducing screen glare under fluorescent gym lights while providing higher contrast than raw white `#FFFFFF`.
- **Surface Variant & Dividers (`#DCECE7`):** Muted structural tone for card borders, inactive switch tracks, and table row dividers.
- **Text Hierarchy:** Primary labels, prices, and member names use `#162D29` (high legibility charcoal evergreen). Secondary metadata, timestamps, and subtitles use `#526963`.
- **Status & Feedback Tokens:**
  - **Success / Active Membership:** Background `#E6F5F0`, Stroke `#2D8A68`, Text `#0D4732`.
  - **Warning / Due Soon / Pending KYC:** Warning surface `#FFF4D6`, Warning Text `#7C5300`, Warning Border `#F1D38A`.
  - **Danger / Expired / Defaulter:** Danger Solid `#A92E2E`, Danger Surface `#FDE8E8`, Danger Text `#6A1616`.
  - **Local-First / Sync Indicator:** Local Cached Badge Surface `#EBF3F1`, Sync Icon `#0D6659`, Text `#162D29`.

## Typography

The type system pairs **Inter** for Latin characters and numbers with **Noto Sans Devanagari** for Hindi text.

### Implementation Rules

- **Font Fallback Stack:** `Inter, 'Noto Sans Devanagari', -apple-system, Roboto, sans-serif`.
- **Currency & Metric Formatting:** Financial metrics and Rupee amounts (`₹`, INR) must use `Inter` with tabular numerals (`font-feature-settings: "tnum" 1`) and standard Indian numbering notation (`₹1,25,000`). Never abbreviate currency units in transactional flows.
- **Bilingual Balance:** When rendering Devanagari alongside Latin labels, enforce matching visual cap heights. Devanagari elements require 10% more vertical line-height room to prevent upper matra clipping (e.g., `line-height: 1.35` baseline instead of `1.2`).
- **Data Densities:** Use `label-sm` strictly for badge counts, table tags, and localized database sync status text. All input text and member names default to `body-md` or `title-sm`.

## Layout & Spacing

Layouts follow an operational, 8-point baseline grid strictly scaled for responsive Android form factors (mobile handsets, front-desk Android tablets, and POS devices).

### Layout Geometry

- **Mobile (Width &lt; 600dp):** Single column fluid canvas. Fixed outer horizontal margin of `16px`, standard card gaps of `12px` to `16px`. Deep evergreen header bars remain pinned to the top.
- **Tablet / Counter POS (600dp - 1024dp):** 12-column fluid grid with `24px` margins and `16px` gutters. Implements split-pane master-detail views: left pane (380dp) displays incoming check-in feeds/search lists; right pane handles membership profiles, fee payments, and ledger modifications.
- **Touch Clearance Guard:** Every interactable surface (buttons, chips, list items, icon buttons, checkboxes) enforces a strict bounding box minimum of **48dp x 48dp**, regardless of visible graphic size.
- **Keyboard Safe Areas:** On-screen number pads for OTP entry and phone lookup pin primary actions directly above the IME keyboard without layout shifts.

## Elevation & Depth

Visual hierarchy uses **tonal layering combined with low-contrast structural outlines**, avoiding muddy drop shadows that wash out under varied hardware displays.

- **Level 0 (Canvas):** `#F4FBF8` flat surface.
- **Level 1 (Cards, List Groups, Panels):** Pure `#FFFFFF` surface resting on the canvas, bounded by a 1px solid stroke in `#DCECE7`. Zero shadow needed; visual separation is achieved through tonal contrast and border definition.
- **Level 2 (Modals, Dropdowns, Datepickers):** Pure `#FFFFFF` surface with 1px stroke in `#DCECE7` plus ambient shadow: `0px 6px 18px -2px rgba(7, 26, 24, 0.08)`.
- **Level 3 (Sticky Action Bars & Bottom Sheets):** `#FFFFFF` with a subtle top border `1px solid #DCECE7` and soft upward diffuse glow: `0px -4px 16px rgba(7, 26, 24, 0.05)`.
- **Operational Header Elevation:** Persistent top header `#071A18` creates an authoritative anchor zone with 0px blur, establishing visual finality at the top of the viewport.

## Shapes

The shape system employs an intentional three-tier curvature model that feels friendly yet industrial and sturdy:

- **Compact Elements (8px / `0.5rem`):** Applied to form text inputs, dropdown selectors, status badges, local storage sync chips, and data table rows.
- **Structural Containers (14px):** Applied to membership summary cards, ledger modules, bottom sheets, alert dialogs, and equipment logs.
- **Pill / Fluid Surfaces (22px to 999px):** Applied to primary and secondary action buttons, quick-filter chips, search bars, and floating check-in triggers.

## Components

### Buttons

- **Primary Action:** Solid background `#0D6659`, text `#FFFFFF`, 48dp height, 22px pill border radius, horizontal padding 24px. Active state changes to `#084B42`.
- **Secondary Action:** Outlined style with 1.5px stroke `#0D6659`, background transparent, text `#0D6659`. Active pressed state fills with `#E6F5F0`.
- **Destructive Action:** Solid background `#A92E2E`, text `#FFFFFF`. Used only for membership termination, member deletion, or reversing confirmed ledger entries.
- **Counter Quick-Action:** Large 56dp height button optimized for single-thumb check-in confirmation at the desk.

### Status Chips & Badges

- **Structure:** Always composed of `[Icon 14dp] + [Gap 4dp] + [Text 12dp SemiBold]`. Height 28dp, 8px radius, horizontal padding 8px.
- **Active / Paid:** Background `#E6F5F0`, border 1px solid `#BEE5D6`, icon & text `#0D4732` (Checkmark icon).
- **Expiring Soon / Due:** Background `#FFF4D6`, border 1px solid `#F1D38A`, icon & text `#7C5300` (Clock/Alert icon).
- **Expired / Defaulter:** Background `#FDE8E8`, border 1px solid `#F5BEBE`, icon & text `#6A1616` (Cross or Warning octagon).
- **Local Cache State Badge:** Neutral chip `#EBF3F1`, 1px solid `#DCECE7`, text `#162D29` with cloud/device icon indicating "Saved Offline" or "Synced to Server".

### Cards

- Surface `#FFFFFF`, 14px border radius, 1px stroke `#DCECE7`, padding 16px.
- Segmented internal headers with `#F4FBF8` background and bottom divider line to clearly distinguish member profile summaries from subscription logs.

### Text Input Fields

- Minimum height 52dp with full 48dp touch clearance.
- Container fill `#FFFFFF`, border 1.5px solid `#DCECE7`, corner radius 8px.
- Focused state: 2px solid border `#0D6659` with subtle 2px outer tint `#E6F5F0`.
- Includes dedicated currency prefix fixed box with `₹` and phone prefix `+91` integrated directly into the input container for fast single-handed Indian contact entry.

### Lists & Member Records

- Row height: Minimum 64dp for single-line with metadata, 76dp for dual-line details.
- Background `#FFFFFF` separated by hairline border `#DCECE7`.
- Leading avatar with member initials or thumbnail (44dp, 22px radius), center title (`#162D29`) + subtitle (`#526963`), trailing side containing dues badge and arrow affordance.

### Checkboxes & Radio Controls

- Minimum hit target 48dp.
- Box dimensions 20dp x 20dp, corner radius 4px (checkboxes) and 20dp circle (radios).
- Inactive: 1.5px stroke `#526963`, background `#FFFFFF`. Active: fill `#0D6659` with white glyph `#FFFFFF`.

### Operational Additions

- **Dual-Script Language Switcher:** A compact, accessible toggle pinned in the top navigation allowing front-desk personnel to switch on-the-fly between English and Hindi (`EN | हिन्दी`).
- **Direct WhatsApp Action Trigger:** Specialized action button `#25D366` background or outline with standard icon to trigger pre-formatted automated fee reminders directly to Indian mobile numbers.
