import type { TemplateRenderer } from "../types";
import {
  baselineAtCenter,
  evenPx,
  measureBand,
  overlaySpacing,
  SidebarLayout,
  statusDateTimeTokens,
} from "./layout";
import {
  activeFields,
  cameraLineFromContext,
  defaultFont,
  drawLogo,
  lensLine,
  settingsLine,
} from "./utils";

/**
 * Sidebar — photo + Overlay-style caption rail (logo → name → lens → settings).
 * `captionDirection: 'rtl'` mirrors photo | rail → rail | photo.
 */
export const sidebar: TemplateRenderer = {
  id: "sidebar",
  name: "Sidebar",
  description: "White mat with Overlay-style caption rail (swap side via captionDirection)",
  async render(rc) {
    const { ctx, canvas, image, imageWidth, imageHeight, exif, options } = rc;
    const font = defaultFont(options.fontFamily);
    const unit = Math.min(imageWidth, imageHeight);

    const mat = evenPx(unit * (options.paddingRatio ?? SidebarLayout.matPercent / 100));
    const gutter = evenPx((unit * SidebarLayout.gutterPercent) / 100);
    const textCol = evenPx((unit * SidebarLayout.textColPercent) / 100);
    const W = mat + imageWidth + gutter + textCol + mat;
    const H = mat + imageHeight + mat;
    const rtl = options.captionDirection === "rtl";

    canvas.width = W;
    canvas.height = H;

    const paper = options.backgroundColor ?? "#ffffff";
    const ink = options.textColor ?? "#111111";
    const muted = options.accentColor ?? "#8a8a8a";

    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, W, H);

    // ltr: photo | rail · rtl: rail | photo
    const imageX = rtl ? mat + textCol + gutter : mat;
    const textX = rtl ? mat : mat + imageWidth + gutter;
    ctx.drawImage(image, imageX, mat, imageWidth, imageHeight);

    const fields = activeFields(rc);
    const { gapY, titleSize, subSize } = overlaySpacing(unit);
    const camera = cameraLineFromContext(rc);
    const lens = lensLine(exif, fields);
    const settings = settingsLine(exif, fields);
    const dateText = statusDateTimeTokens(exif.dateTime, fields).join(" ");

    const showLogo = Boolean(options.showLogo && options.logo);
    ctx.font = `600 ${titleSize}px ${font}`;
    const titleBand = measureBand(ctx, camera || "Hg", titleSize);
    const logoH = showLogo ? Math.max(1, Math.round(titleBand.height)) : 0;

    type Row =
      | { kind: "logo"; size: number }
      | { kind: "name"; size: number; text: string }
      | { kind: "info"; size: number; text: string };

    const rows: Row[] = [];
    if (showLogo) rows.push({ kind: "logo", size: logoH });
    if (camera) rows.push({ kind: "name", size: titleSize, text: camera });
    // Split info so long lens + exposure lines stay inside the rail
    if (lens) rows.push({ kind: "info", size: subSize, text: lens });
    if (settings) rows.push({ kind: "info", size: subSize, text: settings });
    if (dateText) rows.push({ kind: "info", size: subSize, text: dateText });

    if (!rows.length) {
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      return;
    }

    const blockH = rows.reduce((sum, row) => sum + row.size, 0) + gapY * (rows.length - 1);

    const midY = mat + imageHeight / 2;
    let rowTop = midY - blockH / 2;

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    for (const row of rows) {
      const centerY = rowTop + row.size / 2;
      if (row.kind === "logo" && options.logo) {
        await drawLogo(rc, textX, centerY - logoH / 2, logoH, ink);
      } else if (row.kind === "name") {
        ctx.font = `600 ${row.size}px ${font}`;
        const band = measureBand(ctx, row.text, row.size);
        ctx.fillStyle = ink;
        ctx.fillText(row.text, textX, baselineAtCenter(centerY, band.ascent, band.descent));
      } else if (row.kind === "info") {
        ctx.font = `400 ${row.size}px ${font}`;
        const band = measureBand(ctx, row.text, row.size);
        ctx.fillStyle = muted;
        ctx.fillText(row.text, textX, baselineAtCenter(centerY, band.ascent, band.descent));
      }
      rowTop += row.size + gapY;
    }
  },
};
