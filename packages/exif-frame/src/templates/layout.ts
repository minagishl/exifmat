/**
 * Shared caption / status-bar rhythm.
 * Tokens are integers (percent or per-mille). Every token must be a multiple of 2.
 */

/** `base * percent / 100` */
function pct(base: number, percent: number): number {
  return (base * percent) / 100;
}

/** `base * permille / 1000` */
function pm(base: number, permille: number): number {
  return (base * permille) / 1000;
}

/** Even positive integer (compile-time documentation for layout tokens) */
type Even = number;

/** Gallery status bar — % / ‰ of the strip or image short side */
export const GalleryLayout = {
  /** Strip height: ‰ of min(image w, h) → 13% */
  stripOfImage: 130 satisfies Even,
  /** Horizontal unit: ‰ of strip → 28% (edge pad, logo↔name, mm gaps) */
  gapXOfStrip: 280 satisfies Even,
  /** Vertical row gap = gapX / this (must divide evenly into even gapY) */
  gapYDivisor: 4 satisfies Even,
  /** Settings text: ‰ of strip → 22% */
  settingsOfStrip: 220 satisfies Even,
  /** Date / lens text: ‰ of strip → 16.6% */
  dateOfStrip: 166 satisfies Even,
  /** Model text (non-lens): ‰ of strip → 28% */
  modelOfStrip: 280 satisfies Even,
  /**
   * Brand divider (`logo | name`) height as % of the logo band.
   * 124 → slightly taller than the logo/name glyph box, centered on it.
   */
  dividerOfLogoPercent: 124 satisfies Even,
} as const;

/** Overlay caption — % / ‰ of the image short side */
export const OverlayLayout = {
  /** Edge pad: % of min(image w, h) */
  padPercent: 4 satisfies Even,
  /** Classic title / sub: % of min(image w, h) */
  titlePercent: 4 satisfies Even,
  subPercent: 2 satisfies Even,
  /** Vertical gap vs Gallery gapY: % (136 ≈ 1.36×) */
  gapYScalePercent: 136 satisfies Even,
  /** Soft veil height: % of canvas height */
  veilHeightPercent: 34 satisfies Even,
  /**
   * Overlay Glass: source edge depth (px) fed into the tiny wash buffer.
   * Kept short so the mat is edge color, not mirrored subjects.
   */
  glassEdgeSamplePx: 4 satisfies Even,
  /** Overlay Glass: tiny wash buffer width (cols) — downsample kills lines */
  glassWashCols: 48 satisfies Even,
  /** Overlay Glass: tiny wash buffer height (rows) */
  glassWashRows: 8 satisfies Even,
  /** Overlay Glass: blur radius on the fade + strip band (px) */
  glassBlurPx: 64 satisfies Even,
  /**
   * Soft join height inside the photo (‰ of strip). Same-pixel blur ramps
   * across this span and is fully glass at the photo edge.
   */
  glassFadeOfStrip: 1600 satisfies Even,
  /**
   * Invisible side overscan as ‰ of strip — wash extends sideways, blurred,
   * then cropped (no visible side mats).
   */
  glassSideOfStrip: 1000 satisfies Even,
} as const;

/**
 * Stack (centered caption bar).
 * Strip height is content-driven (rows + pad); type follows Overlay.
 */
export const StackLayout = {
  /** Top/bottom inset around the caption stack: % of min(image w, h) */
  padPercent: 4 satisfies Even,
} as const;

/**
 * Sidebar — photo left, caption column on the right.
 * Percents / per-mille of the image short side unless noted.
 */
export const SidebarLayout = {
  /** Outer mat (left / top / bottom / right): % */
  matPercent: 6 satisfies Even,
  /** Space between photo and caption column: % */
  gutterPercent: 4 satisfies Even,
  /** Caption column width: % */
  textColPercent: 36 satisfies Even,
} as const;

/**
 * Minimal / Split museum mat — % of the image short side (or of caption / mat).
 * Shared so Split matches Minimal’s size feel.
 */
export const MinimalLayout = {
  /** Side / top mat: % of min(image w, h) */
  matPercent: 4 satisfies Even,
  /** Caption band height: % */
  captionPercent: 10 satisfies Even,
  /** Extra bottom mat below caption: % */
  matBottomPercent: 4 satisfies Even,
  /** Horizontal gap unit as % of matX (settings token gaps) */
  gapOfMatPercent: 56 satisfies Even,
  /** Primary type: % of caption height */
  primaryOfCaptionPercent: 28 satisfies Even,
  /** Secondary type: % of caption height */
  secondaryOfCaptionPercent: 20 satisfies Even,
  /** Row gap as % of horizontal gap */
  gapYOfGapPercent: 36 satisfies Even,
  /**
   * Split mark `|` height as % of the logo band.
   * Taller than Gallery’s 124 so the rule reads beside two caption rows.
   */
  markDividerOfLogoPercent: 152 satisfies Even,
} as const;

/**
 * Card — rounded photo on a paper mat with a centered caption below.
 * Percents / per-mille of the image short side unless noted.
 */
export const CardLayout = {
  /** Side / top mat: % */
  matPercent: 6 satisfies Even,
  /**
   * Clear space from the photo to the first glyph, and from the last glyph
   * to the canvas edge (same value).
   */
  captionPadPercent: 4 satisfies Even,
  /** Photo corner radius: ‰ → 4.0% */
  radiusOfImage: 40 satisfies Even,
} as const;

/**
 * Crest — logo band above the photo, info band below (white / dark variants).
 * Percents / per-mille of the image short side unless noted.
 */
export const CrestLayout = {
  /** Side mat around the photo: % */
  matPercent: 6 satisfies Even,
  /** Inner pad above/below logo and info glyphs: % */
  bandPadPercent: 4 satisfies Even,
} as const;

/**
 * Spec — header row (brand · date) over a grid of labelled exposure columns.
 * Percents of the image short side unless noted.
 */
export const SpecLayout = {
  /** Mat around the photo: % */
  matPercent: 4 satisfies Even,
  /** Inner pad above the header and below the last row: % */
  padPercent: 4 satisfies Even,
  /** Column label type: % of the value size */
  labelOfValuePercent: 60 satisfies Even,
} as const;

/** measureText fallbacks when bounding-box metrics are missing */
export const GlyphFallback = {
  ascentPercent: 70 satisfies Even,
  descentPercent: 10 satisfies Even,
} as const;

/** Fail fast if a layout token breaks the even rule */
function assertEvenTokens(label: string, tokens: Record<string, number>): void {
  for (const [key, value] of Object.entries(tokens)) {
    if (!Number.isInteger(value) || value % 2 !== 0) {
      throw new Error(`${label}.${key} must be an even integer, got ${value}`);
    }
  }
}

assertEvenTokens("GalleryLayout", GalleryLayout);
assertEvenTokens("OverlayLayout", OverlayLayout);
assertEvenTokens("StackLayout", StackLayout);
assertEvenTokens("SidebarLayout", SidebarLayout);
assertEvenTokens("MinimalLayout", MinimalLayout);
assertEvenTokens("CardLayout", CardLayout);
assertEvenTokens("CrestLayout", CrestLayout);
assertEvenTokens("SpecLayout", SpecLayout);
assertEvenTokens("GlyphFallback", GlyphFallback);

export interface StripSpacing {
  /** Horizontal unit (= edge pad = logo↔name = settings gaps) */
  gapX: number;
  /** gapX / 2 (logo|name halves, time↔date) */
  gapXHalf: number;
  /** gapX / 4 (space between stacked rows) */
  gapY: number;
  /** Left/right inset (same as gapX) */
  padX: number;
  settingsSize: number;
  dateSize: number;
  /** Non-lens model size */
  modelSize: number;
}

/** Snap to a positive multiple of `step` (default 2) */
export function evenPx(value: number, min = 2, step = 2): number {
  const snapped = Math.round(value / step) * step;
  return Math.max(min, snapped);
}

/** Logo height: glyph band snapped to an even pixel count */
export function logoHeight(band: { height: number }): number {
  return evenPx(band.height);
}

/** Logo width from an even height and the logo aspect, snapped to an even pixel count */
export function logoWidth(height: number, aspect: number): number {
  return evenPx(height * aspect);
}

/** Gallery status-bar spacing derived from strip height */
export function stripSpacing(strip: number): StripSpacing {
  // Multiple of 8 so gapX/2 and gapX/4 stay even integers
  const gapX = evenPx(pm(strip, GalleryLayout.gapXOfStrip), 8, 8);
  const gapXHalf = gapX / 2;
  const gapY = gapX / GalleryLayout.gapYDivisor;
  return {
    gapX,
    gapXHalf,
    gapY,
    padX: gapX,
    settingsSize: evenPx(pm(strip, GalleryLayout.settingsOfStrip)),
    dateSize: evenPx(pm(strip, GalleryLayout.dateOfStrip)),
    modelSize: evenPx(pm(strip, GalleryLayout.modelOfStrip)),
  };
}

/** Gallery strip height + spacing for a given image short side. */
export function galleryStripForUnit(unit: number): StripSpacing & { strip: number } {
  const strip = evenPx(pm(unit, GalleryLayout.stripOfImage), 4);
  return { strip, ...stripSpacing(strip) };
}

/**
 * Brand model size on Gallery-style captions (lens layouts use settingsSize).
 */
export function galleryBrandModelSize(
  spacing: Pick<StripSpacing, "modelSize" | "settingsSize">,
  withLens: boolean,
): number {
  return withLens ? spacing.settingsSize : spacing.modelSize;
}

/**
 * Overlay spacing based on Gallery’s gap rhythm, with a slightly
 * larger vertical row gap (`gapYScalePercent`).
 */
export function overlaySpacing(unit: number): StripSpacing & {
  pad: number;
  titleSize: number;
  subSize: number;
} {
  const { strip, ...base } = galleryStripForUnit(unit);
  void strip;
  return {
    ...base,
    gapY: evenPx(pct(base.gapY, OverlayLayout.gapYScalePercent)),
    pad: evenPx(pct(unit, OverlayLayout.padPercent)),
    titleSize: evenPx(pct(unit, OverlayLayout.titlePercent)),
    subSize: evenPx(pct(unit, OverlayLayout.subPercent)),
  };
}

/** Glyph band for a string at the current ctx.font */
export function measureBand(
  ctx: CanvasRenderingContext2D,
  text: string,
  fallbackSize: number,
): { ascent: number; descent: number; height: number } {
  const m = ctx.measureText(text);
  const ascent = m.actualBoundingBoxAscent ?? pct(fallbackSize, GlyphFallback.ascentPercent);
  const descent = m.actualBoundingBoxDescent ?? pct(fallbackSize, GlyphFallback.descentPercent);
  return { ascent, descent, height: ascent + descent };
}

/** Alphabetic baseline so the glyph band is centered on `centerY` */
export function baselineAtCenter(centerY: number, ascent: number, descent: number): number {
  return Math.round(centerY + (ascent - descent) / 2);
}

/**
 * Horizontal ink metrics (compensates font side bearings).
 * `actualBoundingBoxLeft` is distance from the origin toward the left;
 * a negative value means the ink starts to the right of the origin (e.g. “E”).
 */
export function measureInkX(
  ctx: CanvasRenderingContext2D,
  text: string,
): { advance: number; inkWidth: number; boxLeft: number } {
  const m = ctx.measureText(text);
  const boxLeft = m.actualBoundingBoxLeft ?? 0;
  const boxRight = m.actualBoundingBoxRight ?? m.width;
  return {
    advance: m.width,
    inkWidth: boxRight - boxLeft,
    boxLeft,
  };
}

/**
 * `textAlign: 'left'` draw X so the glyph ink’s left edge lands at `inkLeftX`.
 * Closes the extra gap from fonts with a positive left side bearing.
 */
export function xForInkLeft(ctx: CanvasRenderingContext2D, text: string, inkLeftX: number): number {
  return Math.round(inkLeftX + (ctx.measureText(text).actualBoundingBoxLeft ?? 0));
}

/**
 * Vertical metrics for the 1px brand divider (`logo | name`).
 * Slightly taller than `logoH`, centered on the logo band.
 */
export function brandDividerY(groupTop: number, logoH: number): { y: number; h: number } {
  const h = evenPx((logoH * GalleryLayout.dividerOfLogoPercent) / 100);
  return { y: groupTop + (logoH - h) / 2, h };
}

/** Parsed status-bar time / date tokens */
export interface StatusDateTimeParts {
  time: string;
  date: string;
}

/**
 * Parse EXIF datetime into Gallery tokens: `14:55:47` and `2026.10.14`.
 */
export function parseStatusDateTime(value?: string): StatusDateTimeParts | null {
  if (!value) return null;
  const m = value.match(/(\d{4})[:\-./](\d{2})[:\-./](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return {
    time: `${m[4]}:${m[5]}:${m[6]}`,
    date: `${m[1]}.${m[2]}.${m[3]}`,
  };
}

/**
 * Status-bar datetime: `14:55:47` + `2026.10.14`
 * Returns parts joined by `\u0000` for spaced token drawing.
 */
export function formatStatusDateTime(value?: string): string {
  const parts = parseStatusDateTime(value);
  if (parts) return `${parts.time}\u0000${parts.date}`;
  return value ?? "";
}

/** Enabled time/date tokens for captions, respecting `fields`. */
export function statusDateTimeTokens(
  value: string | undefined,
  fields: readonly string[],
): string[] {
  const wantTime = fields.includes("time");
  const wantDate = fields.includes("date");
  if (!wantTime && !wantDate) return [];

  const parts = parseStatusDateTime(value);
  if (!parts) {
    if (value && (wantTime || wantDate)) return [value];
    return [];
  }

  const tokens: string[] = [];
  if (wantTime && parts.time) tokens.push(parts.time);
  if (wantDate && parts.date) tokens.push(parts.date);
  return tokens;
}
