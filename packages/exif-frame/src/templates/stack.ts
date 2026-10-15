import type { TemplateRenderContext, TemplateRenderer } from "../types";
import {
  baselineAtCenter,
  brandDividerY,
  evenPx,
  measureBand,
  measureInkX,
  overlaySpacing,
  StackLayout,
  statusDateTimeTokens,
  xForInkLeft,
  logoHeight,
  logoWidth,
} from "./layout";
import {
  activeFields,
  cameraLineFromContext,
  defaultFont,
  drawLogo,
  lensLine,
  settingsLine,
} from "./utils";

type StackOrientation = "stack" | "row";

function resolveCaption(rc: TemplateRenderContext): {
  camera: string;
  details: string;
  showLogo: boolean;
  titleSize: number;
  subSize: number;
  gapXHalf: number;
  gapY: number;
  font: string;
  shortSide: number;
} {
  const { imageWidth, imageHeight, exif, options } = rc;
  const font = defaultFont(options.fontFamily);
  const shortSide = Math.min(imageWidth, imageHeight);
  const fields = activeFields(rc);
  const { gapXHalf, gapY, titleSize, subSize } = overlaySpacing(shortSide);
  const camera = cameraLineFromContext(rc);
  const lens = lensLine(exif, fields);
  const settings = settingsLine(exif, fields);
  const dateText = statusDateTimeTokens(exif.dateTime, fields).join(" ");
  return {
    camera,
    details: [lens, settings, dateText].filter(Boolean).join("  ·  "),
    showLogo: Boolean(options.showLogo && options.logo),
    titleSize,
    subSize,
    gapXHalf,
    gapY,
    font,
    shortSide,
  };
}

/**
 * Overlay-style caption on a status bar.
 * `stack`: logo → name → details (vertical)
 * `row`: logo · name on top, details below
 */
function createStack(
  id: "stack-white" | "stack-dark" | "stack-row-white" | "stack-row-dark",
  name: string,
  bar: string,
  fg: string,
  muted: string,
  divider: string,
  orientation: StackOrientation,
): TemplateRenderer {
  const horizontal = orientation === "row";
  return {
    id,
    name,
    description: horizontal
      ? `${name} full-bleed photo with logo+name over details`
      : `${name} full-bleed photo with centered Overlay-style caption`,
    async render(rc) {
      const { ctx, canvas, image, imageWidth, imageHeight, options } = rc;
      const { camera, details, showLogo, titleSize, subSize, gapXHalf, gapY, font, shortSide } =
        resolveCaption(rc);
      const fgColor = options.textColor ?? fg;
      const mutedColor = options.accentColor ?? muted;

      ctx.font = `600 ${titleSize}px ${font}`;
      const titleBand = measureBand(ctx, camera || "Hg", titleSize);
      const logoH = showLogo ? logoHeight(titleBand) : 0;
      const logoW = showLogo && options.logo ? logoWidth(logoH, options.logo.aspect) : 0;
      // Ink width (not advance) so centering matches the optically corrected draw
      const nameInk = camera ? measureInkX(ctx, camera) : null;
      const nameW = nameInk?.inkWidth ?? 0;

      const padY = evenPx(shortSide * (options.paddingRatio ?? StackLayout.padPercent / 100), 4);

      let strip: number;
      let blockH: number;

      if (horizontal) {
        // Top: logo · name  /  Bottom: details
        const topH = Math.max(logoH, camera ? titleSize : 0);
        const hasTop = showLogo || Boolean(camera);
        const hasBottom = Boolean(details);
        blockH = (hasTop ? topH : 0) + (hasBottom ? subSize : 0) + (hasTop && hasBottom ? gapY : 0);
        strip = evenPx(blockH + padY * 2, 4);
      } else {
        const rowCount = (showLogo ? 1 : 0) + (camera ? 1 : 0) + (details ? 1 : 0);
        blockH =
          (showLogo ? logoH : 0) +
          (camera ? titleSize : 0) +
          (details ? subSize : 0) +
          gapY * Math.max(0, rowCount - 1);
        strip = evenPx(blockH + padY * 2, 4);
      }

      const W = imageWidth;
      const H = imageHeight + strip;
      canvas.width = W;
      canvas.height = H;

      ctx.drawImage(image, 0, 0, imageWidth, imageHeight);
      ctx.fillStyle = options.backgroundColor ?? bar;
      ctx.fillRect(0, imageHeight, W, strip);

      const midY = imageHeight + strip / 2;
      const centerX = W / 2;

      if (horizontal) {
        const topH = Math.max(logoH, camera ? titleSize : 0);
        const hasTop = showLogo || Boolean(camera);
        let rowTop = midY - blockH / 2;

        if (hasTop) {
          const centerY = rowTop + topH / 2;
          // Gallery brand group: logo ·½gap· | ·½gap· name
          const brandW =
            (showLogo ? logoW : 0) +
            (camera ? nameW : 0) +
            (showLogo && camera ? gapXHalf + 1 + gapXHalf : 0);
          let x = centerX - brandW / 2;
          if (showLogo && options.logo) {
            const groupTop = centerY - logoH / 2;
            await drawLogo(rc, x, groupTop, logoH, fgColor);
            x += logoW + gapXHalf;
            if (camera) {
              ctx.fillStyle = divider;
              const div = brandDividerY(groupTop, logoH);
              ctx.fillRect(x, div.y, 1, div.h);
              x += 1 + gapXHalf;
            }
          }
          if (camera) {
            ctx.font = `600 ${titleSize}px ${font}`;
            ctx.fillStyle = fgColor;
            ctx.textAlign = "left";
            ctx.textBaseline = "alphabetic";
            ctx.fillText(
              camera,
              xForInkLeft(ctx, camera, x),
              baselineAtCenter(centerY, titleBand.ascent, titleBand.descent),
            );
          }
          rowTop += topH + (details ? gapY : 0);
        }

        if (details) {
          const centerY = rowTop + subSize / 2;
          ctx.font = `400 ${subSize}px ${font}`;
          const band = measureBand(ctx, details, subSize);
          ctx.fillStyle = mutedColor;
          ctx.textAlign = "center";
          ctx.textBaseline = "alphabetic";
          ctx.fillText(details, centerX, baselineAtCenter(centerY, band.ascent, band.descent));
        }
      } else {
        type StackRow =
          | { kind: "logo"; size: number }
          | { kind: "name"; size: number; text: string }
          | { kind: "details"; size: number; text: string };
        const rows: StackRow[] = [];
        if (showLogo) rows.push({ kind: "logo", size: logoH });
        if (camera) rows.push({ kind: "name", size: titleSize, text: camera });
        if (details) {
          rows.push({ kind: "details", size: subSize, text: details });
        }

        let rowTop = midY - blockH / 2;
        for (const row of rows) {
          const centerY = rowTop + row.size / 2;
          if (row.kind === "logo" && options.logo) {
            await drawLogo(rc, centerX - logoW / 2, centerY - logoH / 2, logoH, fgColor);
          } else if (row.kind === "name") {
            ctx.font = `600 ${row.size}px ${font}`;
            const band = measureBand(ctx, row.text, row.size);
            ctx.fillStyle = fgColor;
            ctx.textAlign = "center";
            ctx.textBaseline = "alphabetic";
            ctx.fillText(row.text, centerX, baselineAtCenter(centerY, band.ascent, band.descent));
          } else if (row.kind === "details") {
            ctx.font = `400 ${row.size}px ${font}`;
            const band = measureBand(ctx, row.text, row.size);
            ctx.fillStyle = mutedColor;
            ctx.textAlign = "center";
            ctx.textBaseline = "alphabetic";
            ctx.fillText(row.text, centerX, baselineAtCenter(centerY, band.ascent, band.descent));
          }
          rowTop += row.size + gapY;
        }
      }

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    },
  };
}

export const stackWhite = createStack(
  "stack-white",
  "Stack White",
  "#ffffff",
  "#111111",
  "rgba(0,0,0,0.55)",
  "rgba(0,0,0,0.18)",
  "stack",
);

export const stackDark = createStack(
  "stack-dark",
  "Stack Dark",
  "#000000",
  "#ffffff",
  "rgba(255,255,255,0.75)",
  "rgba(255,255,255,0.28)",
  "stack",
);

export const stackRowWhite = createStack(
  "stack-row-white",
  "Stack Row White",
  "#ffffff",
  "#111111",
  "rgba(0,0,0,0.55)",
  "rgba(0,0,0,0.18)",
  "row",
);

export const stackRowDark = createStack(
  "stack-row-dark",
  "Stack Row Dark",
  "#000000",
  "#ffffff",
  "rgba(255,255,255,0.75)",
  "rgba(255,255,255,0.28)",
  "row",
);
