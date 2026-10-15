# AGENTS.md

Conventions for agents working on this repository. Prefer these over inventing new layout systems.

## Language

- Product code, comments, UI strings, commits, and docs in this repo are **English only**.

## Template layout (`packages/exifmat/src/templates/`)

Shared spacing lives in `layout.ts`. Gallery defines the rhythm; Overlay reuses it (with a slightly larger vertical gap). Minimal snaps metrics through `evenPx` as well.

### Scale tokens

- Do **not** hardcode float ratios like `0.13` in templates.
- Put scales in `GalleryLayout` / `OverlayLayout` / `StackLayout` / `SidebarLayout` / `MinimalLayout` / `CardLayout` / `CrestLayout` / `GlyphFallback` as **integers**:
  - **percent** (`padPercent: 4` → 4%)
  - **per-mille** (`stripOfImage: 130` → 13.0%)
- Every layout token value must be a **multiple of 2**. `assertEvenTokens` enforces this at module load.

### Even pixel rule

Computed layout lengths (pads, gaps, strip height, font sizes, veil height, etc.) must go through `evenPx()` so the result is a positive multiple of 2 (use step `8` for `gapX` so `/2` and `/4` stay even).

```ts
evenPx(value); // → 2, 4, 6, …
evenPx(value, 8, 8); // → 8, 16, 24, …  (gapX)
```

Use helpers:

- `stripSpacing(strip)` — Gallery status-bar metrics
- `overlaySpacing(unit)` — Overlay metrics (includes `gapY * gapYScalePercent / 100`)

### Gallery rhythm

| Token      | Meaning                                                               |
| ---------- | --------------------------------------------------------------------- |
| `gapX`     | Horizontal unit = edge pad = logo↔name total = settings token gaps    |
| `gapXHalf` | `gapX / 2` — logo \| name halves; time↔date                           |
| `gapY`     | `gapX / 4` — clear space between stacked rows (settings ↔ date, etc.) |

Brand group: `logo · gapXHalf · | · gapXHalf · model` (divider is 1px; see exceptions).

Date/time for Gallery-style captions: `statusDateTimeTokens` → `14:55:47` and/or `2026.10.14` from fields `time` / `date`.

### Exceptions (not required to be even)

These may be odd or fractional; do not force `evenPx` on them:

1. **`logoH`** — derived from real glyph bounds (`measureBand` / `actualBoundingBox*`).
2. **Divider width** — always **1px**. Height uses `brandDividerY` (slightly taller than `logoH`).
3. **`midY` / `blockTop` (and derived row centers)** — geometric centers that follow `imageHeight` / caption block placement. Odd image heights can yield odd centers; that is OK.

### What not to do

- Don’t introduce ad-hoc `Math.round(unit * 0.xx)` for spacing in new or revised templates; extend `layout.ts` tokens and use `evenPx` / `stripSpacing` / `overlaySpacing`.
- Don’t change Gallery gap ratios in Overlay without going through `OverlayLayout` (e.g. `gapYScalePercent`, `veilHeightPercent`).

## Commits

- Conventional Commits, **lowercase** subject only (see project commit conventions).
