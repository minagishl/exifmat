import type { ExifField, NormalizedExif, TemplateRenderContext, TemplateRenderer } from "../types";
import {
  baselineAtCenter,
  brandDividerY,
  evenPx,
  GalleryLayout,
  measureBand,
  statusDateTimeTokens,
  galleryBrandModelSize,
  stripSpacing,
  xForInkLeft,
  logoHeight,
  logoWidth,
} from "./layout";
import { activeFields, cameraLineFromContext, defaultFont, drawLogo, lensLine } from "./utils";

/** Collect settings parts for spaced drawing */
function statusSettingsParts(exif: NormalizedExif, fields: ExifField[]): string[] {
  const parts: string[] = [];
  if (fields.includes("focalLength") && exif.focalLength) {
    parts.push(exif.focalLength);
  }
  if (fields.includes("aperture") && exif.aperture) {
    parts.push(exif.aperture);
  }
  if (fields.includes("shutter") && exif.shutterSpeed) {
    parts.push(exif.shutterSpeed);
  }
  if (fields.includes("iso") && exif.iso) {
    parts.push(exif.iso.replace(/\s+/g, ""));
  }
  return parts;
}

function brandGroupWidth(
  rc: TemplateRenderContext,
  opts: {
    model: string;
    modelSize: number;
    modelWeight: string;
    font: string;
    gapHalf: number;
  },
): { width: number; logoH: number; band: ReturnType<typeof measureBand> } {
  const { ctx, options } = rc;
  ctx.font = `${opts.modelWeight} ${opts.modelSize}px ${opts.font}`;
  const band = measureBand(ctx, opts.model || "Hg", opts.modelSize);
  const logoH = logoHeight(band);
  let width = opts.model ? ctx.measureText(opts.model).width : 0;
  if (options.showLogo && options.logo) {
    width +=
      logoWidth(logoH, options.logo.aspect) + opts.gapHalf + (opts.model ? 1 + opts.gapHalf : 0);
  }
  return { width, logoH, band };
}

/**
 * Brand group: logo ·½gap· | ·½gap· model
 * Logo height matches the model glyph band; the whole group shares one centerY.
 */
async function drawBrandGroup(
  rc: TemplateRenderContext,
  opts: {
    x: number;
    centerY: number;
    model: string;
    modelSize: number;
    modelWeight: string;
    font: string;
    gapHalf: number;
    fg: string;
    divider: string;
  },
): Promise<number> {
  const { ctx, options } = rc;
  const { logoH, band } = brandGroupWidth(rc, opts);
  const groupTop = opts.centerY - logoH / 2;
  const baseline = baselineAtCenter(opts.centerY, band.ascent, band.descent);

  let x = opts.x;
  if (options.showLogo && options.logo) {
    const logoW = await drawLogo(rc, x, groupTop, logoH, opts.fg);
    x += logoW + opts.gapHalf;

    if (opts.model) {
      ctx.fillStyle = opts.divider;
      const div = brandDividerY(groupTop, logoH);
      ctx.fillRect(x, div.y, 1, div.h);
      x += 1 + opts.gapHalf;
    }
  }

  if (opts.model) {
    ctx.fillStyle = opts.fg;
    ctx.font = `${opts.modelWeight} ${opts.modelSize}px ${opts.font}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    // Place by ink edge so side bearings (e.g. Inter “E”) don’t widen the gap
    ctx.fillText(opts.model, xForInkLeft(ctx, opts.model, x), baseline);
  }

  return logoH;
}

/** Draw tokens right-aligned with a shared glyph-centered baseline */
function drawTokenRowRight(
  ctx: CanvasRenderingContext2D,
  opts: {
    parts: string[];
    rightX: number;
    centerY: number;
    size: number;
    weight: string;
    font: string;
    color: string;
    tokenGap: number;
  },
): void {
  if (!opts.parts.length) return;
  ctx.font = `${opts.weight} ${opts.size}px ${opts.font}`;
  const band = measureBand(ctx, opts.parts[0]!, opts.size);
  const baseline = baselineAtCenter(opts.centerY, band.ascent, band.descent);

  ctx.fillStyle = opts.color;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  let x = opts.rightX;
  for (let i = opts.parts.length - 1; i >= 0; i--) {
    const part = opts.parts[i]!;
    ctx.fillText(part, x, baseline);
    if (i > 0) x -= ctx.measureText(part).width + opts.tokenGap;
  }
}

/** Draw tokens left-aligned from `leftX` */
function drawTokenRowLeft(
  ctx: CanvasRenderingContext2D,
  opts: {
    parts: string[];
    leftX: number;
    centerY: number;
    size: number;
    weight: string;
    font: string;
    color: string;
    tokenGap: number;
  },
): void {
  if (!opts.parts.length) return;
  ctx.font = `${opts.weight} ${opts.size}px ${opts.font}`;
  const band = measureBand(ctx, opts.parts[0]!, opts.size);
  const baseline = baselineAtCenter(opts.centerY, band.ascent, band.descent);

  ctx.fillStyle = opts.color;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  let x = opts.leftX;
  for (let i = 0; i < opts.parts.length; i++) {
    const part = opts.parts[i]!;
    ctx.fillText(part, x, baseline);
    x += ctx.measureText(part).width + opts.tokenGap;
  }
}

function createGallery(
  id: "gallery-white" | "gallery-dark" | "gallery-white-lens" | "gallery-dark-lens",
  name: string,
  bar: string,
  fg: string,
  muted: string,
  divider: string,
  withLens = false,
): TemplateRenderer {
  return {
    id,
    name,
    description: withLens
      ? `${name} full-bleed photo with status bar and lens`
      : `${name} full-bleed photo with refined status bar`,
    async render(rc) {
      const { ctx, canvas, image, imageWidth, imageHeight, exif, options } = rc;
      const font = defaultFont(options.fontFamily);
      const strip = evenPx(
        Math.min(imageWidth, imageHeight) *
          (options.paddingRatio ?? GalleryLayout.stripOfImage / 1000),
        4,
      );
      const W = imageWidth;
      const H = imageHeight + strip;

      canvas.width = W;
      canvas.height = H;

      ctx.drawImage(image, 0, 0, imageWidth, imageHeight);

      ctx.fillStyle = options.backgroundColor ?? bar;
      ctx.fillRect(0, imageHeight, W, strip);

      const fields = activeFields(rc);
      const {
        gapX,
        gapXHalf,
        gapY,
        padX,
        settingsSize,
        dateSize,
        modelSize: modelSizeFull,
      } = stripSpacing(strip);
      const midY = imageHeight + strip / 2;
      const modelSize = galleryBrandModelSize({ modelSize: modelSizeFull, settingsSize }, withLens);
      const modelWeight = "600";
      const fgColor = options.textColor ?? fg;
      const mutedColor = options.accentColor ?? muted;

      const model = cameraLineFromContext(rc);
      const lens = withLens ? lensLine(exif, fields) : "";
      const settingsParts = statusSettingsParts(exif, fields);
      const dateParts = statusDateTimeTokens(exif.dateTime, fields);

      // Row groups: brand(+lens) ↔ settings(+date); `rtl` swaps sides
      const rtl = options.captionDirection === "rtl";
      const dualBrand = Boolean(withLens && lens);
      const dualInfo = settingsParts.length > 0 && dateParts.length > 0;

      // Shared vertical rhythm: center the two-row block in the strip
      const blockH = settingsSize + gapY + dateSize;
      const blockTop = midY - blockH / 2;
      const topRowCenter = blockTop + settingsSize / 2;
      const bottomRowCenter = blockTop + settingsSize + gapY + dateSize / 2;

      const brandCenter = dualBrand ? topRowCenter : midY;
      const settingsCenter = dualBrand || dualInfo ? topRowCenter : midY;
      const dateCenter = dualBrand || dualInfo ? bottomRowCenter : midY;
      const lensCenter = dualBrand ? bottomRowCenter : midY;

      const brandEdge = rtl ? W - padX : padX;
      const infoEdge = rtl ? padX : W - padX;

      // —— Brand group (logo | model) ——
      if (model || (options.showLogo && options.logo)) {
        const brandOpts = {
          model: model || "",
          modelSize,
          modelWeight,
          font,
          gapHalf: gapXHalf,
          fg: fgColor,
          divider,
          centerY: brandCenter,
        };
        const { width } = brandGroupWidth(rc, brandOpts);
        await drawBrandGroup(rc, {
          ...brandOpts,
          x: rtl ? brandEdge - width : brandEdge,
        });
      }

      // —— Lens (with-lens only), under brand ——
      if (lens) {
        ctx.font = `400 ${dateSize}px ${font}`;
        const band = measureBand(ctx, lens, dateSize);
        ctx.fillStyle = mutedColor;
        ctx.textBaseline = "alphabetic";
        if (rtl) {
          ctx.textAlign = "right";
          ctx.fillText(lens, brandEdge, baselineAtCenter(lensCenter, band.ascent, band.descent));
        } else {
          ctx.textAlign = "left";
          ctx.fillText(lens, brandEdge, baselineAtCenter(lensCenter, band.ascent, band.descent));
        }
      }

      // —— Settings / date ——
      if (settingsParts.length) {
        if (rtl) {
          drawTokenRowLeft(ctx, {
            parts: settingsParts,
            leftX: infoEdge,
            centerY: settingsCenter,
            size: settingsSize,
            weight: "600",
            font,
            color: fgColor,
            tokenGap: gapX,
          });
        } else {
          drawTokenRowRight(ctx, {
            parts: settingsParts,
            rightX: infoEdge,
            centerY: settingsCenter,
            size: settingsSize,
            weight: "600",
            font,
            color: fgColor,
            tokenGap: gapX,
          });
        }
      }
      if (dateParts.length) {
        if (rtl) {
          drawTokenRowLeft(ctx, {
            parts: dateParts,
            leftX: infoEdge,
            centerY: dateCenter,
            size: dateSize,
            weight: "400",
            font,
            color: mutedColor,
            tokenGap: gapXHalf,
          });
        } else {
          drawTokenRowRight(ctx, {
            parts: dateParts,
            rightX: infoEdge,
            centerY: dateCenter,
            size: dateSize,
            weight: "400",
            font,
            color: mutedColor,
            tokenGap: gapXHalf,
          });
        }
      }

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    },
  };
}

export const galleryWhite = createGallery(
  "gallery-white",
  "Gallery White",
  "#ffffff",
  "#111111",
  "#737373",
  "rgba(0,0,0,0.18)",
);

export const galleryDark = createGallery(
  "gallery-dark",
  "Gallery Dark",
  "#000000",
  "#ffffff",
  "rgba(255,255,255,0.55)",
  "rgba(255,255,255,0.28)",
);

export const galleryWhiteLens = createGallery(
  "gallery-white-lens",
  "Gallery White Lens",
  "#ffffff",
  "#111111",
  "#737373",
  "rgba(0,0,0,0.18)",
  true,
);

export const galleryDarkLens = createGallery(
  "gallery-dark-lens",
  "Gallery Dark Lens",
  "#000000",
  "#ffffff",
  "rgba(255,255,255,0.55)",
  "rgba(255,255,255,0.28)",
  true,
);
