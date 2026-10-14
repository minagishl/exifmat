import type { ExifField, NormalizedExif, TemplateRenderer } from "../types";
import {
  baselineAtCenter,
  brandDividerY,
  CardLayout,
  evenPx,
  measureBand,
  measureInkX,
  overlaySpacing,
  statusDateTimeTokens,
  xForInkLeft,
} from "./layout";
import { activeFields, cameraLineFromContext, defaultFont, drawLogo, roundRect } from "./utils";

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
 * Card — paper mat with a rounded photo and a centered two-line caption
 * (camera above settings + time/date).
 */
export const card: TemplateRenderer = {
  id: "card",
  name: "Card",
  description: "Rounded photo on a paper mat with centered camera and exposure caption",
  async render(rc) {
    const { ctx, canvas, image, imageWidth, imageHeight, exif, options } = rc;
    const font = defaultFont(options.fontFamily);
    const unit = Math.min(imageWidth, imageHeight);

    const matX = evenPx(unit * (options.paddingRatio ?? CardLayout.matPercent / 100));
    const matTop = matX;
    const captionPad = evenPx((unit * CardLayout.captionPadPercent) / 100);
    const radius = evenPx(options.borderRadius ?? unit * (CardLayout.radiusOfImage / 1000));
    // Same type scale and logo·|·name rhythm as Overlay Gallery Lens
    const { gapXHalf, gapY, dateSize, modelSize } = overlaySpacing(unit);

    const fields = activeFields(rc);
    const model = cameraLineFromContext(rc);
    const settings = settingsParts(exif, fields);
    const dateParts = statusDateTimeTokens(exif.dateTime, fields);
    const detailParts = [...settings, ...dateParts];
    const showLogo = Boolean(options.showLogo && options.logo);

    const hasCamera = Boolean(model) || showLogo;
    const hasDetails = detailParts.length > 0;

    ctx.font = `600 ${modelSize}px ${font}`;
    const cameraBand = measureBand(ctx, model || "Hg", modelSize);
    const cameraInk = cameraBand.height;
    ctx.font = `400 ${dateSize}px ${font}`;
    const infoSample = settings[0] ?? dateParts[0] ?? "Hg";
    const infoInk = measureBand(ctx, infoSample, dateSize).height;

    // Same clear space above the first glyph and below the last.
    const firstSize = hasCamera ? modelSize : dateSize;
    const firstInk = hasCamera ? cameraInk : infoInk;
    const outer =
      hasCamera || hasDetails
        ? evenPx(captionPad + Math.max(0, (firstSize - firstInk) / 2))
        : captionPad;
    const rowGap =
      hasCamera && hasDetails
        ? evenPx((modelSize - cameraInk) / 2 + gapY + (dateSize - infoInk) / 2)
        : 0;

    const photoBottom = matTop + imageHeight;
    let cursor = photoBottom + (hasCamera || hasDetails ? outer : captionPad);
    const cameraCenter = cursor + cameraInk / 2;
    if (hasCamera) cursor += cameraInk + rowGap;
    const detailsCenter = cursor + infoInk / 2;
    if (hasDetails) cursor += infoInk;
    if (hasCamera || hasDetails) cursor += outer;

    const W = imageWidth + matX * 2;
    const H = cursor;
    const centerX = W / 2;

    canvas.width = W;
    canvas.height = H;

    const paper = options.backgroundColor ?? "#f5f5f3";
    const ink = options.textColor ?? "#1a1a1a";
    const muted = options.accentColor ?? "#5c5c5c";

    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    roundRect(ctx, matX, matTop, imageWidth, imageHeight, radius);
    ctx.clip();
    ctx.drawImage(image, matX, matTop, imageWidth, imageHeight);
    ctx.restore();

    if (hasCamera) {
      ctx.font = `600 ${modelSize}px ${font}`;
      const sample = model || "Hg";
      const band = measureBand(ctx, sample, modelSize);
      const logoH = showLogo ? Math.max(1, Math.round(band.height)) : 0;
      const logoW = showLogo && options.logo ? logoH * options.logo.aspect : 0;
      const nameInk = model ? measureInkX(ctx, model) : null;
      const nameW = nameInk?.inkWidth ?? 0;
      // Overlay Gallery Lens: logo · gapXHalf · | · gapXHalf · name
      const groupW = logoW + nameW + (showLogo && model ? gapXHalf + 1 + gapXHalf : 0);
      let x = centerX - groupW / 2;
      const groupTop = cameraCenter - logoH / 2;

      if (showLogo && options.logo) {
        await drawLogo(rc, x, groupTop, logoH, ink);
        x += logoW + gapXHalf;
        if (model) {
          ctx.fillStyle = "rgba(0,0,0,0.18)";
          const div = brandDividerY(groupTop, logoH);
          ctx.fillRect(x, div.y, 1, div.h);
          x += 1 + gapXHalf;
        }
      }
      if (model) {
        const baseline = baselineAtCenter(cameraCenter, band.ascent, band.descent);
        ctx.fillStyle = ink;
        ctx.font = `600 ${modelSize}px ${font}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(model, xForInkLeft(ctx, model, x), baseline);
      }
    }

    if (hasDetails) {
      // One secondary row: settings + time/date, same size as Overlay date line
      const parts = detailParts;
      ctx.font = `400 ${dateSize}px ${font}`;
      const band = measureBand(ctx, parts[0]!, dateSize);
      const baseline = baselineAtCenter(detailsCenter, band.ascent, band.descent);
      let total = 0;
      for (let i = 0; i < parts.length; i++) {
        total += ctx.measureText(parts[i]!).width;
        if (i < parts.length - 1) total += gapXHalf;
      }
      let x = centerX - total / 2;
      ctx.fillStyle = muted;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]!;
        ctx.fillText(part, x, baseline);
        x += ctx.measureText(part).width + gapXHalf;
      }
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  },
};
