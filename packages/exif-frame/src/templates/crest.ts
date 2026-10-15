import type { ExifField, NormalizedExif, TemplateRenderer } from "../types";
import {
  baselineAtCenter,
  CrestLayout,
  evenPx,
  measureBand,
  overlaySpacing,
  statusDateTimeTokens,
  xForInkLeft,
  logoHeight,
  logoWidth,
} from "./layout";
import { activeFields, cameraLineFromContext, defaultFont, drawLogo } from "./utils";

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

function createCrest(
  id: "crest-white" | "crest-dark",
  name: string,
  paper: string,
  fg: string,
  muted: string,
): TemplateRenderer {
  return {
    id,
    name,
    description: "Logo above the photo, camera + exposure info below on a mat",
    async render(rc) {
      const { ctx, canvas, image, imageWidth, imageHeight, exif, options } = rc;
      const font = defaultFont(options.fontFamily);
      const unit = Math.min(imageWidth, imageHeight);

      const matX = evenPx(unit * (options.paddingRatio ?? CrestLayout.matPercent / 100));
      const bandPad = evenPx((unit * CrestLayout.bandPadPercent) / 100);
      const { gapXHalf, gapY, dateSize, modelSize } = overlaySpacing(unit);

      ctx.font = `600 ${modelSize}px ${font}`;
      const logoBand = measureBand(ctx, "Hg", modelSize);
      const logoH = logoHeight(logoBand);

      const fields = activeFields(rc);
      const model = cameraLineFromContext(rc);
      const settings = settingsParts(exif, fields);
      const dateParts = statusDateTimeTokens(exif.dateTime, fields);
      const detailParts = [...settings, ...dateParts];
      const showLogo = Boolean(options.showLogo && options.logo);

      const hasCameraLine = Boolean(model);
      const hasDetails = detailParts.length > 0;
      const hasBottom = hasCameraLine || hasDetails;

      ctx.font = `600 ${modelSize}px ${font}`;
      const cameraInk = hasCameraLine ? measureBand(ctx, model, modelSize).height : 0;
      ctx.font = `400 ${dateSize}px ${font}`;
      const infoSample = detailParts[0] ?? "Hg";
      const infoInk = hasDetails ? measureBand(ctx, infoSample, dateSize).height : 0;

      const firstSize = hasCameraLine ? modelSize : dateSize;
      const firstInk = hasCameraLine ? cameraInk : infoInk;
      const outer = hasBottom ? evenPx(bandPad + Math.max(0, (firstSize - firstInk) / 2)) : 0;
      const rowGap =
        hasCameraLine && hasDetails
          ? evenPx((modelSize - cameraInk) / 2 + gapY + (dateSize - infoInk) / 2)
          : 0;

      const topBandH = showLogo ? evenPx(bandPad * 2 + logoH) : 0;
      const photoY = topBandH;
      const photoBottom = photoY + imageHeight;

      let cursor = photoBottom + (hasBottom ? outer : 0);
      const cameraCenter = cursor + cameraInk / 2;
      if (hasCameraLine) cursor += cameraInk + rowGap;
      const detailsCenter = cursor + infoInk / 2;
      if (hasDetails) cursor += infoInk;
      if (hasBottom) cursor += outer;

      const W = imageWidth + matX * 2;
      const H = cursor;
      const centerX = W / 2;

      canvas.width = W;
      canvas.height = H;

      const bg = options.backgroundColor ?? paper;
      const ink = options.textColor ?? fg;
      const mutedColor = options.accentColor ?? muted;

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(image, matX, photoY, imageWidth, imageHeight);

      if (showLogo && options.logo) {
        const logoW = logoWidth(logoH, options.logo.aspect);
        await drawLogo(rc, centerX - logoW / 2, bandPad, logoH, ink);
      }

      if (hasCameraLine) {
        ctx.font = `600 ${modelSize}px ${font}`;
        const band = measureBand(ctx, model, modelSize);
        const baseline = baselineAtCenter(cameraCenter, band.ascent, band.descent);
        const textW = ctx.measureText(model).width;
        ctx.fillStyle = ink;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(model, xForInkLeft(ctx, model, centerX - textW / 2), baseline);
      }

      if (hasDetails) {
        ctx.font = `400 ${dateSize}px ${font}`;
        const band = measureBand(ctx, detailParts[0]!, dateSize);
        const baseline = baselineAtCenter(detailsCenter, band.ascent, band.descent);
        let total = 0;
        for (let i = 0; i < detailParts.length; i++) {
          total += ctx.measureText(detailParts[i]!).width;
          if (i < detailParts.length - 1) total += gapXHalf;
        }
        let x = centerX - total / 2;
        ctx.fillStyle = mutedColor;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        for (let i = 0; i < detailParts.length; i++) {
          const part = detailParts[i]!;
          ctx.fillText(part, x, baseline);
          x += ctx.measureText(part).width + gapXHalf;
        }
      }

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    },
  };
}

export const crestWhite = createCrest(
  "crest-white",
  "Crest White",
  "#f5f5f3",
  "#1a1a1a",
  "#8c8c8c",
);

export const crestDark = createCrest(
  "crest-dark",
  "Crest Dark",
  "#111111",
  "#ffffff",
  "rgba(255,255,255,0.55)",
);
