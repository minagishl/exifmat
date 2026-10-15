import type { TemplateRenderer } from "../types";
import {
  baselineAtCenter,
  brandDividerY,
  evenPx,
  logoHeight,
  logoWidth,
  measureBand,
  overlaySpacing,
  RailLayout,
  statusDateTimeTokens,
} from "./layout";
import { activeFields, cameraLineFromContext, defaultFont, drawLogo, settingsParts } from "./utils";

interface RailPalette {
  paper: string;
  ink: string;
  muted: string;
  divider: string;
}

/**
 * Rail — the caption runs vertically in a slim column beside the photo
 * (logo | camera, then exposure), reading bottom-to-top. `rtl` moves the
 * column to the left and reads top-to-bottom.
 */
function createRail(
  id: "rail-white" | "rail-dark",
  name: string,
  palette: RailPalette,
): TemplateRenderer {
  return {
    id,
    name,
    description: `${name} mat with a vertical caption column beside the photo`,
    async render(rc) {
      const { ctx, canvas, image, imageWidth, imageHeight, exif, options } = rc;
      const font = defaultFont(options.fontFamily);
      const unit = Math.min(imageWidth, imageHeight);

      const matX = evenPx(unit * (options.paddingRatio ?? RailLayout.matPercent / 100));
      const railGap = evenPx((unit * RailLayout.railGapPercent) / 100);
      const { gapXHalf, gapY, modelSize, dateSize } = overlaySpacing(unit);

      const fields = activeFields(rc);
      const model = cameraLineFromContext(rc);
      const details = [
        ...settingsParts(exif, fields),
        ...statusDateTimeTokens(exif.dateTime, fields),
      ].join("  ·  ");
      const showLogo = Boolean(options.showLogo && options.logo);

      // Measure before the canvas resize (which resets ctx state)
      const nameFont = `600 ${modelSize}px ${font}`;
      const detailFont = `400 ${dateSize}px ${font}`;
      ctx.font = nameFont;
      const nameBand = measureBand(ctx, model || "Hg", modelSize);
      const nameW = model ? ctx.measureText(model).width : 0;
      ctx.font = detailFont;
      const detailBand = measureBand(ctx, details || "Hg", dateSize);
      const detailW = details ? ctx.measureText(details).width : 0;

      const logoH = showLogo ? logoHeight(nameBand) : 0;
      const logoW = showLogo && options.logo ? logoWidth(logoH, options.logo.aspect) : 0;

      // Two rows along the photo's edge: brand, then exposure (dropped if too long)
      const brandLen = logoW + (logoW && model ? gapXHalf + 1 + gapXHalf : 0) + nameW;
      const hasBrand = brandLen > 0;
      const hasDetails = Boolean(details) && detailW <= imageHeight;
      const brandH = hasBrand ? Math.max(logoH, modelSize) : 0;
      const detailH = hasDetails ? dateSize : 0;
      const rowsW = brandH + (hasBrand && hasDetails ? gapY : 0) + detailH;
      const railW = rowsW > 0 ? railGap + rowsW : 0;

      const W = imageWidth + matX * 2 + railW;
      const H = imageHeight + matX * 2;

      canvas.width = W;
      canvas.height = H;

      const paper = options.backgroundColor ?? palette.paper;
      const ink = options.textColor ?? palette.ink;
      const muted = options.accentColor ?? palette.muted;
      const rtl = options.captionDirection === "rtl";

      const photoX = rtl ? matX + railW : matX;
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(image, photoX, matX, imageWidth, imageHeight);

      if (railW > 0) {
        // Local x runs along the photo edge, local y across the column
        ctx.save();
        if (rtl) {
          ctx.translate(matX + rowsW, matX);
          ctx.rotate(Math.PI / 2);
        } else {
          ctx.translate(photoX + imageWidth + railGap, matX + imageHeight);
          ctx.rotate(-Math.PI / 2);
        }
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

        let rowY = 0;
        if (hasBrand) {
          const centerY = rowY + brandH / 2;
          let x = 0;
          if (logoW && options.logo) {
            await drawLogo(rc, x, centerY - logoH / 2, logoH, ink);
            x += logoW + gapXHalf;
            if (model) {
              // 1px mark, drawn across the column like the other brand groups
              ctx.fillStyle = palette.divider;
              const div = brandDividerY(centerY - logoH / 2, logoH);
              ctx.fillRect(x, div.y, 1, div.h);
              x += 1 + gapXHalf;
            }
          }
          if (model) {
            ctx.font = nameFont;
            ctx.fillStyle = ink;
            ctx.fillText(model, x, baselineAtCenter(centerY, nameBand.ascent, nameBand.descent));
          }
          rowY += brandH + gapY;
        }
        if (hasDetails) {
          const centerY = rowY + dateSize / 2;
          ctx.font = detailFont;
          ctx.fillStyle = muted;
          ctx.fillText(
            details,
            0,
            baselineAtCenter(centerY, detailBand.ascent, detailBand.descent),
          );
        }
        ctx.restore();
      }

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    },
  };
}

export const railWhite = createRail("rail-white", "Rail White", {
  paper: "#f5f5f3",
  ink: "#1a1a1a",
  muted: "#7a7a7a",
  divider: "rgba(0,0,0,0.18)",
});

export const railDark = createRail("rail-dark", "Rail Dark", {
  paper: "#111111",
  ink: "#f5f5f5",
  muted: "rgba(255,255,255,0.55)",
  divider: "rgba(255,255,255,0.28)",
});
