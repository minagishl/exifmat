import type { ExifField, NormalizedExif, TemplateRenderer } from "../types";
import {
  baselineAtCenter,
  brandDividerY,
  evenPx,
  measureBand,
  MinimalLayout,
  statusDateTimeTokens,
  xForInkLeft,
} from "./layout";
import { activeFields, cameraLineFromContext, defaultFont, drawLogo, lensLine } from "./utils";

function settingsParts(exif: NormalizedExif, fields: ExifField[]): string[] {
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

/**
 * Minimal — museum-mat frame.
 * Quiet paper margin around the photo; caption sits in the deeper bottom mat
 * as two groups (brand left, exposure right) sharing one baseline band.
 */
export const minimal: TemplateRenderer = {
  id: "minimal",
  name: "Minimal",
  description: "Museum mat with a quiet brand / exposure caption",
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

    const paper = options.backgroundColor ?? "#f5f5f3";
    const ink = options.textColor ?? "#1a1a1a";
    const muted = options.accentColor ?? "#8c8c8c";

    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(image, matX, matTop, imageWidth, imageHeight);

    const ruleY = matTop + imageHeight;
    ctx.fillStyle = "rgba(0,0,0,0.1)";
    ctx.fillRect(matX, ruleY, imageWidth, 1);

    const fields = activeFields(rc);
    const model = cameraLineFromContext(rc);
    const lens = lensLine(exif, fields);
    const settings = settingsParts(exif, fields);
    // Gallery format: time and/or date per fields (`14:55:47` / `2026.10.14`)
    const date = statusDateTimeTokens(exif.dateTime, fields).join(" ");

    const gap = evenPx((matX * MinimalLayout.gapOfMatPercent) / 100, 4, 4);
    const gapHalf = gap / 2;
    const primarySize = evenPx((captionH * MinimalLayout.primaryOfCaptionPercent) / 100);
    const secondarySize = evenPx((captionH * MinimalLayout.secondaryOfCaptionPercent) / 100);
    const dual = Boolean(lens || date) && Boolean(model || settings.length);

    const captionTop = ruleY;
    const captionMid = captionTop + captionH / 2;
    const gapY = evenPx((gap * MinimalLayout.gapYOfGapPercent) / 100);
    const blockH = dual ? primarySize + gapY + secondarySize : primarySize;
    const blockTop = captionMid - blockH / 2;
    const topCenter = blockTop + primarySize / 2;
    const bottomCenter = blockTop + primarySize + gapY + secondarySize / 2;

    const rtl = options.captionDirection === "rtl";
    const brandEdge = rtl ? W - matX : matX;
    const infoEdge = rtl ? matX : W - matX;

    if (model || (options.showLogo && options.logo)) {
      ctx.font = `600 ${primarySize}px ${font}`;
      const sample = model || "Hg";
      const band = measureBand(ctx, sample, primarySize);
      const logoH = Math.max(1, Math.round(band.height));
      const groupTop = topCenter - logoH / 2;
      const baseline = baselineAtCenter(topCenter, band.ascent, band.descent);

      let brandW = model ? ctx.measureText(model).width : 0;
      if (options.showLogo && options.logo) {
        brandW += logoH * options.logo.aspect + gapHalf + (model ? 1 + gapHalf : 0);
      }
      let x = rtl ? brandEdge - brandW : brandEdge;

      if (options.showLogo && options.logo) {
        const logoW = await drawLogo(rc, x, groupTop, logoH, ink);
        x += logoW + gapHalf;
        if (model) {
          ctx.fillStyle = "rgba(0,0,0,0.18)";
          const div = brandDividerY(groupTop, logoH);
          ctx.fillRect(x, div.y, 1, div.h);
          x += 1 + gapHalf;
        }
      }

      if (model) {
        ctx.fillStyle = ink;
        ctx.font = `600 ${primarySize}px ${font}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(model, xForInkLeft(ctx, model, x), baseline);
      }
    }

    if (settings.length) {
      ctx.font = `600 ${primarySize}px ${font}`;
      const band = measureBand(ctx, settings[0]!, primarySize);
      const baseline = baselineAtCenter(topCenter, band.ascent, band.descent);
      ctx.fillStyle = ink;
      ctx.textBaseline = "alphabetic";
      if (rtl) {
        ctx.textAlign = "left";
        let x = infoEdge;
        for (let i = 0; i < settings.length; i++) {
          const part = settings[i]!;
          ctx.fillText(part, x, baseline);
          x += ctx.measureText(part).width + gap;
        }
      } else {
        ctx.textAlign = "right";
        let x = infoEdge;
        for (let i = settings.length - 1; i >= 0; i--) {
          const part = settings[i]!;
          ctx.fillText(part, x, baseline);
          if (i > 0) x -= ctx.measureText(part).width + gap;
        }
      }
    }

    if (dual) {
      ctx.textBaseline = "alphabetic";
      if (lens) {
        ctx.font = `400 ${secondarySize}px ${font}`;
        const band = measureBand(ctx, lens, secondarySize);
        ctx.fillStyle = muted;
        ctx.textAlign = rtl ? "right" : "left";
        ctx.fillText(lens, brandEdge, baselineAtCenter(bottomCenter, band.ascent, band.descent));
      }
      if (date) {
        ctx.font = `400 ${secondarySize}px ${font}`;
        const band = measureBand(ctx, date, secondarySize);
        ctx.fillStyle = muted;
        ctx.textAlign = rtl ? "left" : "right";
        ctx.fillText(date, infoEdge, baselineAtCenter(bottomCenter, band.ascent, band.descent));
      }
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  },
};
