import type { ExifField, NormalizedExif, TemplateRenderer } from "../types";
import {
  baselineAtCenter,
  evenPx,
  measureBand,
  MinimalLayout,
  statusDateTimeTokens,
  xForInkLeft,
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

function tokenRowWidth(ctx: CanvasRenderingContext2D, parts: string[], tokenGap: number): number {
  if (!parts.length) return 0;
  let w = 0;
  for (let i = 0; i < parts.length; i++) {
    w += ctx.measureText(parts[i]!).width;
    if (i < parts.length - 1) w += tokenGap;
  }
  return w;
}

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

/**
 * Split — Minimal mat size with Leica-style caption:
 * model / lens · logo | settings / date.
 * `captionDirection: 'rtl'` mirrors the two groups.
 */
function createSplit(
  id: "split-dark" | "split-white",
  name: string,
  paper: string,
  ink: string,
  muted: string,
  divider: string,
  rule: string,
): TemplateRenderer {
  return {
    id,
    name,
    description: `${name} mat (model/lens · logo | settings)`,
    async render(rc) {
      const { ctx, canvas, image, imageWidth, imageHeight, exif, options } = rc;
      const font = defaultFont(options.fontFamily);
      const unit = Math.min(imageWidth, imageHeight);

      const matX = evenPx(unit * (options.paddingRatio ?? MinimalLayout.matPercent / 100));
      const matTop = matX;
      const captionH = evenPx((unit * MinimalLayout.captionPercent) / 100, 4);
      const matBottom = evenPx((unit * MinimalLayout.matBottomPercent) / 100);
      const W = imageWidth + matX * 2;
      const H = imageHeight + matTop + captionH + matBottom;

      canvas.width = W;
      canvas.height = H;

      const paperColor = options.backgroundColor ?? paper;
      const fgColor = options.textColor ?? ink;
      const mutedColor = options.accentColor ?? muted;

      ctx.fillStyle = paperColor;
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(image, matX, matTop, imageWidth, imageHeight);

      const ruleY = matTop + imageHeight;
      ctx.fillStyle = rule;
      ctx.fillRect(matX, ruleY, imageWidth, 1);

      const fields = activeFields(rc);
      const model = cameraLineFromContext(rc);
      const lens = lensLine(exif, fields);
      const settingsParts = statusSettingsParts(exif, fields);
      const dateParts = statusDateTimeTokens(exif.dateTime, fields);

      const gap = evenPx((matX * MinimalLayout.gapOfMatPercent) / 100, 4, 4);
      const gapHalf = gap / 2;
      const primarySize = evenPx((captionH * MinimalLayout.primaryOfCaptionPercent) / 100);
      const secondarySize = evenPx((captionH * MinimalLayout.secondaryOfCaptionPercent) / 100);
      const gapY = evenPx((gap * MinimalLayout.gapYOfGapPercent) / 100);

      const dualBrand = Boolean(model && lens);
      const dualInfo = settingsParts.length > 0 && dateParts.length > 0;
      const dual = dualBrand || dualInfo;

      const captionMid = ruleY + captionH / 2;
      const blockH = dual ? primarySize + gapY + secondarySize : primarySize;
      const blockTop = captionMid - blockH / 2;
      const topCenter = blockTop + primarySize / 2;
      const bottomCenter = blockTop + primarySize + gapY + secondarySize / 2;

      const brandCenter = dualBrand ? topCenter : captionMid;
      const lensCenter = dualBrand ? bottomCenter : captionMid;
      const settingsCenter = dual ? topCenter : captionMid;
      const dateCenter = dual ? bottomCenter : captionMid;

      const rtl = options.captionDirection === "rtl";
      const brandEdge = rtl ? W - matX : matX;
      const infoEdge = rtl ? matX : W - matX;
      const primaryWeight = "600";

      // —— Brand (model / lens) ——
      if (model) {
        ctx.font = `${primaryWeight} ${primarySize}px ${font}`;
        const band = measureBand(ctx, model, primarySize);
        const baseline = baselineAtCenter(brandCenter, band.ascent, band.descent);
        ctx.fillStyle = fgColor;
        ctx.textBaseline = "alphabetic";
        if (rtl) {
          ctx.textAlign = "right";
          ctx.fillText(model, brandEdge, baseline);
        } else {
          ctx.textAlign = "left";
          ctx.fillText(model, xForInkLeft(ctx, model, brandEdge), baseline);
        }
      }

      if (lens) {
        ctx.font = `400 ${secondarySize}px ${font}`;
        const band = measureBand(ctx, lens, secondarySize);
        ctx.fillStyle = mutedColor;
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = rtl ? "right" : "left";
        ctx.fillText(lens, brandEdge, baselineAtCenter(lensCenter, band.ascent, band.descent));
      }

      // —— Mark cluster: logo | settings (+ date under settings) ——
      const showLogo = Boolean(options.showLogo && options.logo);
      ctx.font = `${primaryWeight} ${primarySize}px ${font}`;
      const settingsW = tokenRowWidth(ctx, settingsParts, gap);
      ctx.font = `400 ${secondarySize}px ${font}`;
      const dateW = tokenRowWidth(ctx, dateParts, gapHalf);
      const textColW = Math.max(settingsW, dateW);

      // Same scale as Minimal: logo height = primary glyph band
      ctx.font = `${primaryWeight} ${primarySize}px ${font}`;
      const primaryBand = measureBand(ctx, settingsParts[0] || model || "Hg", primarySize);
      let logoH = 0;
      let logoW = 0;
      if (showLogo && options.logo) {
        logoH = Math.max(1, Math.round(primaryBand.height));
        logoW = logoH * options.logo.aspect;
      }

      // One rhythm: logo · gap · | · gap · mm · gap · f · …
      const markGap = gap;

      const hasMark = showLogo || settingsParts.length > 0 || dateParts.length > 0;
      if (hasMark) {
        const gapLogoDiv = showLogo && textColW > 0 ? markGap : 0;
        const gapDivText = showLogo && textColW > 0 ? markGap : 0;
        const divW = showLogo && textColW > 0 ? 1 : 0;
        const clusterW = logoW + gapLogoDiv + divW + gapDivText + textColW;

        // ltr: cluster ends at right mat · rtl: cluster starts at left mat
        let x = rtl ? infoEdge : infoEdge - clusterW;

        if (showLogo && options.logo) {
          // Vertically center the mark in the caption band (beside the divider)
          const logoTop = captionMid - logoH / 2;
          await drawLogo(rc, x, logoTop, logoH, fgColor);
          x += logoW;

          if (textColW > 0) {
            x += gapLogoDiv;
            ctx.fillStyle = divider;
            const divH = evenPx((logoH * MinimalLayout.markDividerOfLogoPercent) / 100);
            const divY = captionMid - divH / 2;
            ctx.fillRect(x, divY, 1, divH);
            x += 1 + gapDivText;
          }
        }

        const textLeft = x;
        if (settingsParts.length) {
          drawTokenRowLeft(ctx, {
            parts: settingsParts,
            leftX: textLeft,
            centerY: settingsCenter,
            size: primarySize,
            weight: primaryWeight,
            font,
            color: fgColor,
            tokenGap: markGap,
          });
        }
        if (dateParts.length) {
          drawTokenRowLeft(ctx, {
            parts: dateParts,
            leftX: textLeft,
            centerY: dateCenter,
            size: secondarySize,
            weight: "400",
            font,
            color: mutedColor,
            tokenGap: gapHalf,
          });
        }
      }

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    },
  };
}

export const splitDark = createSplit(
  "split-dark",
  "Split Dark",
  "#111111",
  "#ffffff",
  "rgba(255,255,255,0.55)",
  "rgba(255,255,255,0.28)",
  "rgba(255,255,255,0.12)",
);

export const splitWhite = createSplit(
  "split-white",
  "Split White",
  "#f5f5f3",
  "#1a1a1a",
  "#8c8c8c",
  "rgba(0,0,0,0.18)",
  "rgba(0,0,0,0.1)",
);
