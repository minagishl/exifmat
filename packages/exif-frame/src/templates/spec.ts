import type { TemplateRenderer } from "../types";
import {
  baselineAtCenter,
  brandDividerY,
  evenPx,
  logoHeight,
  logoWidth,
  measureBand,
  overlaySpacing,
  SpecLayout,
  statusDateTimeTokens,
  xForInkLeft,
} from "./layout";
import { activeFields, cameraLineFromContext, defaultFont, drawLogo, lensLine } from "./utils";

interface SpecPalette {
  paper: string;
  ink: string;
  muted: string;
  rule: string;
  divider: string;
}

/**
 * Spec — header row (logo | camera, lens · date) above a ruled grid of
 * labelled exposure columns.
 */
function createSpec(
  id: "spec-white" | "spec-dark",
  name: string,
  palette: SpecPalette,
): TemplateRenderer {
  return {
    id,
    name,
    description: `${name} mat with a brand header and a labelled exposure grid`,
    async render(rc) {
      const { ctx, canvas, image, imageWidth, imageHeight, exif, options } = rc;
      const font = defaultFont(options.fontFamily);
      const unit = Math.min(imageWidth, imageHeight);

      const matX = evenPx(unit * (options.paddingRatio ?? SpecLayout.matPercent / 100));
      const pad = evenPx((unit * SpecLayout.padPercent) / 100);
      const { gapXHalf, gapY, modelSize, settingsSize, dateSize } = overlaySpacing(unit);
      const labelSize = evenPx((settingsSize * SpecLayout.labelOfValuePercent) / 100);

      const fields = activeFields(rc);
      const model = cameraLineFromContext(rc);
      const lens = lensLine(exif, fields);
      const date = statusDateTimeTokens(exif.dateTime, fields).join(" ");
      const showLogo = Boolean(options.showLogo && options.logo);
      const right = [lens, date].filter(Boolean).join("  ·  ");

      const columns: { label: string; value: string }[] = [];
      if (fields.includes("focalLength") && exif.focalLength) {
        columns.push({ label: "FOCAL", value: exif.focalLength });
      }
      if (fields.includes("aperture") && exif.aperture) {
        columns.push({ label: "APERTURE", value: exif.aperture });
      }
      if (fields.includes("shutter") && exif.shutterSpeed) {
        columns.push({ label: "SHUTTER", value: exif.shutterSpeed });
      }
      if (fields.includes("iso") && exif.iso) {
        columns.push({ label: "ISO", value: exif.iso.replace(/\s+/g, "") });
      }

      const hasHeader = Boolean(model) || showLogo || Boolean(right);
      const hasColumns = columns.length > 0;

      ctx.font = `600 ${modelSize}px ${font}`;
      const brandBand = measureBand(ctx, model || "Hg", modelSize);
      const logoH = showLogo ? logoHeight(brandBand) : 0;
      const headerH = hasHeader ? Math.max(logoH, modelSize) : 0;
      const columnsH = hasColumns ? labelSize + gapY + settingsSize : 0;
      // header · gap · rule · gap · columns, each present part separated by gapXHalf
      const innerGap = hasHeader && hasColumns ? gapXHalf * 2 + 1 : 0;

      const bottomMat = hasHeader || hasColumns ? pad * 2 + headerH + innerGap + columnsH : matX;
      const W = imageWidth + matX * 2;
      const H = matX + imageHeight + bottomMat;

      canvas.width = W;
      canvas.height = H;

      const paper = options.backgroundColor ?? palette.paper;
      const ink = options.textColor ?? palette.ink;
      const muted = options.accentColor ?? palette.muted;

      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(image, matX, matX, imageWidth, imageHeight);

      const rtl = options.captionDirection === "rtl";
      const leftEdge = matX;
      const rightEdge = W - matX;
      let cursor = matX + imageHeight + pad;
      ctx.textBaseline = "alphabetic";

      if (hasHeader) {
        const centerY = cursor + headerH / 2;
        const logoW = showLogo && options.logo ? logoWidth(logoH, options.logo.aspect) : 0;
        // Resizing the canvas resets ctx state, so set the font before measuring
        ctx.font = `600 ${modelSize}px ${font}`;
        const nameW = model ? ctx.measureText(model).width : 0;
        const brandW = logoW + nameW + (logoW && model ? gapXHalf + 1 + gapXHalf : 0);
        let x = rtl ? rightEdge - brandW : leftEdge;
        const groupTop = centerY - logoH / 2;

        if (logoW && options.logo) {
          await drawLogo(rc, x, groupTop, logoH, ink);
          x += logoW + gapXHalf;
          if (model) {
            ctx.fillStyle = palette.divider;
            const div = brandDividerY(groupTop, logoH);
            ctx.fillRect(x, div.y, 1, div.h);
            x += 1 + gapXHalf;
          }
        }
        if (model) {
          ctx.font = `600 ${modelSize}px ${font}`;
          ctx.fillStyle = ink;
          ctx.textAlign = "left";
          ctx.fillText(
            model,
            xForInkLeft(ctx, model, x),
            baselineAtCenter(centerY, brandBand.ascent, brandBand.descent),
          );
        }
        if (right) {
          ctx.font = `400 ${dateSize}px ${font}`;
          const band = measureBand(ctx, right, dateSize);
          ctx.fillStyle = muted;
          ctx.textAlign = rtl ? "left" : "right";
          ctx.fillText(
            right,
            rtl ? leftEdge : rightEdge,
            baselineAtCenter(centerY, band.ascent, band.descent),
          );
        }
        cursor += headerH;
      }

      if (hasHeader && hasColumns) {
        cursor += gapXHalf;
        ctx.fillStyle = palette.rule;
        ctx.fillRect(leftEdge, cursor, imageWidth, 1);
        cursor += 1 + gapXHalf;
      }

      if (hasColumns) {
        const colW = evenPx(imageWidth / columns.length);
        const labelCenter = cursor + labelSize / 2;
        const valueCenter = cursor + labelSize + gapY + settingsSize / 2;
        ctx.textAlign = "left";
        columns.forEach((col, i) => {
          const x = leftEdge + i * colW;
          ctx.font = `500 ${labelSize}px ${font}`;
          const lb = measureBand(ctx, col.label, labelSize);
          ctx.fillStyle = muted;
          ctx.fillText(
            col.label,
            xForInkLeft(ctx, col.label, x),
            baselineAtCenter(labelCenter, lb.ascent, lb.descent),
          );
          ctx.font = `600 ${settingsSize}px ${font}`;
          const vb = measureBand(ctx, col.value, settingsSize);
          ctx.fillStyle = ink;
          ctx.fillText(
            col.value,
            xForInkLeft(ctx, col.value, x),
            baselineAtCenter(valueCenter, vb.ascent, vb.descent),
          );
        });
      }

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    },
  };
}

export const specWhite = createSpec("spec-white", "Spec White", {
  paper: "#f5f5f3",
  ink: "#1a1a1a",
  muted: "#8c8c8c",
  rule: "rgba(0,0,0,0.12)",
  divider: "rgba(0,0,0,0.18)",
});

export const specDark = createSpec("spec-dark", "Spec Dark", {
  paper: "#111111",
  ink: "#f5f5f5",
  muted: "rgba(255,255,255,0.55)",
  rule: "rgba(255,255,255,0.14)",
  divider: "rgba(255,255,255,0.28)",
});
