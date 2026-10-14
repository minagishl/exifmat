import type { ExifField, NormalizedExif, TemplateRenderContext, TemplateRenderer } from "../types";
import { getCanvasEnvironment } from "../canvas";
import {
  baselineAtCenter,
  brandDividerY,
  evenPx,
  galleryBrandModelSize,
  galleryStripForUnit,
  measureBand,
  OverlayLayout,
  overlaySpacing,
  statusDateTimeTokens,
  xForInkLeft,
} from "./layout";
import {
  activeFields,
  cameraLineFromContext,
  defaultFont,
  drawLogo,
  lensLine,
  settingsLine,
} from "./utils";

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

function drawVeil(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const gradH = evenPx((H * OverlayLayout.veilHeightPercent) / 100, 4);
  const grad = ctx.createLinearGradient(0, H - gradH, 0, H);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(0.35, "rgba(0,0,0,0.18)");
  grad.addColorStop(0.7, "rgba(0,0,0,0.48)");
  grad.addColorStop(1, "rgba(0,0,0,0.78)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, H - gradH, W, gradH);
}

/**
 * Glass edge mat (top or bottom). The fade is a blur of the same photo pixels;
 * the strip outside the photo is an edge-color wash. Both are blurred together
 * so the wash join sits inside the glass and no hard divider shows.
 *
 * `photoY` is where the photo’s top edge sits on `ctx` (photo already drawn).
 */
async function drawGlassExtendBlur(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  srcW: number,
  srcH: number,
  photoW: number,
  photoH: number,
  strip: number,
  edge: "top" | "bottom",
  photoY: number,
): Promise<void> {
  const blurPx = OverlayLayout.glassBlurPx;
  const over = evenPx(blurPx);
  const fadeH = evenPx(Math.max(strip * (OverlayLayout.glassFadeOfStrip / 1000), blurPx * 2), 4);
  const side = evenPx(Math.max(strip * (OverlayLayout.glassSideOfStrip / 1000), blurPx * 2), 4);
  const bandH = fadeH + strip;
  const scaleY = photoH / srcH;
  const srcFadeH = Math.min(srcH, Math.max(1, Math.round(fadeH / scaleY)));
  const sample = Math.min(OverlayLayout.glassEdgeSamplePx, srcFadeH);
  const washW = OverlayLayout.glassWashCols;
  const washH = OverlayLayout.glassWashRows;
  const edgeX = Math.min(srcW, Math.max(1, Math.round(srcW / photoW)));

  // Source rects: top edge vs bottom edge of the photo
  const srcFadeY = edge === "top" ? 0 : srcH - srcFadeH;
  const srcSampleY = edge === "top" ? 0 : srcH - sample;

  const env = await getCanvasEnvironment();

  const wash = env.createCanvas(washW, washH);
  const wctx = wash.getContext("2d");
  if (!wctx) return;
  wctx.drawImage(image, 0, srcSampleY, srcW, sample, 0, 0, washW, washH);

  const leftPad = over + side;
  const padW = photoW + side * 2 + over * 2;
  const padH = bandH + over * 2;
  const padded = env.createCanvas(padW, padH);
  const pctx = padded.getContext("2d");
  if (!pctx) return;
  pctx.imageSmoothingEnabled = true;

  // Pad layout (top→bottom): for bottom edge [fade | strip]; for top [strip | fade]
  const fadePadY = edge === "bottom" ? over : over + strip;
  const stripPadY = edge === "bottom" ? over + fadeH : over;

  pctx.drawImage(wash.asImageSource(), 0, 0, padW, padH);
  pctx.drawImage(image, 0, srcFadeY, srcW, srcFadeH, leftPad, fadePadY, photoW, fadeH);
  pctx.drawImage(image, 0, srcFadeY, edgeX, srcFadeH, 0, fadePadY, leftPad, fadeH);
  pctx.drawImage(
    image,
    srcW - edgeX,
    srcFadeY,
    edgeX,
    srcFadeH,
    leftPad + photoW,
    fadePadY,
    over + side,
    fadeH,
  );
  // Blur padding beyond the fade (into the photo side of the pad)
  const padPhotoY = edge === "bottom" ? 0 : over + bandH;
  pctx.drawImage(
    image,
    0,
    srcFadeY + (edge === "top" ? srcFadeH - sample : 0),
    srcW,
    sample,
    leftPad,
    padPhotoY,
    photoW,
    over,
  );

  const blurredPad = env.createCanvas(padW, padH);
  const bctx = blurredPad.getContext("2d");
  if (!bctx) return;
  bctx.save();
  try {
    bctx.filter = `blur(${blurPx}px)`;
  } catch {
    // filter may be unavailable in some Node builds
  }
  bctx.drawImage(padded.asImageSource(), 0, 0);
  bctx.filter = "none";
  bctx.restore();

  const band = env.createCanvas(photoW, bandH);
  const bandCtx = band.getContext("2d");
  if (!bandCtx) return;
  bandCtx.drawImage(blurredPad.asImageSource(), leftPad, over, photoW, bandH, 0, 0, photoW, bandH);
  bandCtx.globalCompositeOperation = "destination-in";
  const mask = bandCtx.createLinearGradient(0, 0, 0, bandH);
  if (edge === "bottom") {
    const join = fadeH / bandH;
    for (const t of [0, 0.2, 0.45, 0.7, 0.88, 1]) {
      const s = t * t * (3 - 2 * t);
      mask.addColorStop(join * t, `rgba(0,0,0,${s})`);
    }
    mask.addColorStop(1, "rgba(0,0,0,1)");
  } else {
    const join = strip / bandH;
    mask.addColorStop(0, "rgba(0,0,0,1)");
    mask.addColorStop(join, "rgba(0,0,0,1)");
    for (const t of [0, 0.12, 0.3, 0.55, 0.8, 1]) {
      const s = 1 - t * t * (3 - 2 * t);
      mask.addColorStop(join + (1 - join) * t, `rgba(0,0,0,${s})`);
    }
  }
  bandCtx.fillStyle = mask;
  bandCtx.fillRect(0, 0, photoW, bandH);

  const stripY = edge === "bottom" ? photoY + photoH : photoY - strip;
  const bandY = edge === "bottom" ? photoY + photoH - fadeH : photoY - strip;

  ctx.drawImage(
    blurredPad.asImageSource(),
    leftPad,
    stripPadY,
    photoW,
    strip,
    0,
    stripY,
    photoW,
    strip,
  );
  ctx.drawImage(band.asImageSource(), 0, bandY);
}

/** Average RGB of a canvas rect (for iOS-like caption vibrancy). */
function sampleRectAverage(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): { r: number; g: number; b: number } {
  const rw = Math.max(1, Math.floor(w));
  const rh = Math.max(1, Math.floor(h));
  let data: ImageData;
  try {
    data = ctx.getImageData(Math.floor(x), Math.floor(y), rw, rh);
  } catch {
    return { r: 40, g: 40, b: 40 };
  }
  const px = data.data;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const step = Math.max(4, Math.floor((rw * rh) / 4000) * 4);
  for (let i = 0; i < px.length; i += step) {
    r += px[i]!;
    g += px[i + 1]!;
    b += px[i + 2]!;
    n++;
  }
  if (!n) return { r: 40, g: 40, b: 40 };
  return { r: r / n, g: g / n, b: b / n };
}

/**
 * Caption colors that harmonize with the backdrop (light tint on dark,
 * dark tint on light) — similar to iOS vibrancy over blur.
 */
function adaptiveCaptionColors(avg: { r: number; g: number; b: number }): {
  fg: string;
  muted: string;
  divider: string;
} {
  const lum = (0.2126 * avg.r + 0.7152 * avg.g + 0.0722 * avg.b) / 255;
  if (lum < 0.58) {
    const t = 0.78;
    const r = Math.round(avg.r + (255 - avg.r) * t);
    const g = Math.round(avg.g + (255 - avg.g) * t);
    const b = Math.round(avg.b + (255 - avg.b) * t);
    return {
      fg: `rgb(${r},${g},${b})`,
      muted: `rgba(${r},${g},${b},0.7)`,
      divider: `rgba(${r},${g},${b},0.35)`,
    };
  }
  const t = 0.62;
  const r = Math.round(avg.r * (1 - t));
  const g = Math.round(avg.g * (1 - t));
  const b = Math.round(avg.b * (1 - t));
  return {
    fg: `rgb(${r},${g},${b})`,
    muted: `rgba(${r},${g},${b},0.72)`,
    divider: `rgba(${r},${g},${b},0.28)`,
  };
}

/** Shared classic Overlay caption stack (logo → camera → details). */
async function drawOverlayClassicCaption(rc: TemplateRenderContext): Promise<void> {
  const { ctx, imageWidth, imageHeight, exif, options } = rc;
  const font = defaultFont(options.fontFamily);
  const W = imageWidth;
  const H = imageHeight;
  const unit = Math.min(W, H);
  const fields = activeFields(rc);
  const { pad, titleSize, subSize, gapY: rowGap } = overlaySpacing(unit);
  const fg = options.textColor ?? "#ffffff";
  const muted = options.accentColor ?? "rgba(255,255,255,0.75)";
  const rtl = options.captionDirection === "rtl";
  const edge = rtl ? W - pad : pad;

  const camera = cameraLineFromContext(rc);
  const lens = lensLine(exif, fields);
  const settings = settingsLine(exif, fields);
  const dateText = statusDateTimeTokens(exif.dateTime, fields).join(" ");
  const sub = [lens, settings, dateText].filter(Boolean).join("  ·  ");

  let y = H - pad;
  ctx.textAlign = rtl ? "right" : "left";
  ctx.textBaseline = "alphabetic";

  if (sub) {
    ctx.fillStyle = muted;
    ctx.font = `400 ${subSize}px ${font}`;
    const band = measureBand(ctx, sub, subSize);
    ctx.fillText(sub, edge, y);
    y -= band.height + rowGap;
  }

  if (camera) {
    ctx.fillStyle = fg;
    ctx.font = `600 ${titleSize}px ${font}`;
    const band = measureBand(ctx, camera, titleSize);
    ctx.fillText(camera, edge, y);
    if (options.showLogo && options.logo) {
      y -= band.height + rowGap;
    }
  }

  if (options.showLogo && options.logo) {
    ctx.font = `600 ${titleSize}px ${font}`;
    const band = measureBand(ctx, camera || "Hg", titleSize);
    const logoH = Math.max(1, Math.round(band.height));
    const logoW = logoH * options.logo.aspect;
    const logoX = rtl ? edge - logoW : edge;
    await drawLogo(rc, logoX, y - logoH, logoH, fg);
  }

  ctx.textAlign = "left";
}

function drawTokenRow(
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

/** Classic stack: logo → camera → lens · settings (bottom-left; rtl → bottom-right) */
function createOverlayClassic(): TemplateRenderer {
  return {
    id: "overlay",
    name: "Overlay",
    description: "Full-bleed photo with stacked caption on a soft gradient",
    async render(rc) {
      const { ctx, canvas, image, imageWidth, imageHeight } = rc;
      const W = imageWidth;
      const H = imageHeight;

      canvas.width = W;
      canvas.height = H;
      ctx.drawImage(image, 0, 0, W, H);
      drawVeil(ctx, W, H);
      await drawOverlayClassicCaption(rc);
    },
  };
}

/**
 * Gallery-style overlay caption.
 * withLens=false: brand centered left; settings+date stacked right (gallery normal)
 * withLens=true: brand+lens left; settings+date right (gallery lens)
 * withRule=true: lens layout + hairline under the caption block
 */
function createOverlayGallery(withLens: boolean, withRule = false): TemplateRenderer {
  const id = withRule ? "overlay-rule" : withLens ? "overlay-gallery-lens" : "overlay-gallery";
  const name = withRule ? "Overlay Rule" : withLens ? "Overlay Gallery Lens" : "Overlay Gallery";
  const description = withRule
    ? "Gallery lens caption with a bottom rule on a soft gradient"
    : withLens
      ? "Overlay caption matching Gallery with lens"
      : "Overlay caption matching Gallery layout";

  return {
    id,
    name,
    description,
    async render(rc) {
      const { ctx, canvas, image, imageWidth, imageHeight, exif, options } = rc;
      const font = defaultFont(options.fontFamily);
      const W = imageWidth;
      const H = imageHeight;
      const unit = Math.min(W, H);

      canvas.width = W;
      canvas.height = H;
      ctx.drawImage(image, 0, 0, W, H);
      drawVeil(ctx, W, H);

      const fields = activeFields(rc);
      const { pad, gapX, gapXHalf, gapY, settingsSize, dateSize, modelSize } = overlaySpacing(unit);
      const brandModelSize = galleryBrandModelSize(
        { modelSize, settingsSize },
        withLens || withRule,
      );
      const fg = options.textColor ?? "#ffffff";
      const muted = options.accentColor ?? "rgba(255,255,255,0.72)";

      const model = cameraLineFromContext(rc);
      const lens = withLens || withRule ? lensLine(exif, fields) : "";
      const settings = settingsParts(exif, fields);
      const dateParts = statusDateTimeTokens(exif.dateTime, fields);

      const dualLeft = Boolean(lens);
      const dualRight = settings.length > 0 && dateParts.length > 0;

      const blockH = settingsSize + gapY + dateSize;
      // Rule sits on the bottom pad; caption block stacks above it
      const ruleGap = withRule ? evenPx(gapY) : 0;
      const blockBottom = H - pad - ruleGap;
      const blockTop = blockBottom - blockH;
      const topCenter = blockTop + settingsSize / 2;
      const bottomCenter = blockTop + settingsSize + gapY + dateSize / 2;
      const singleCenter = blockTop + blockH / 2;

      const rtl = options.captionDirection === "rtl";
      // Gallery normal: brand side stays on singleCenter; info side may be two rows
      const brandCenter = dualLeft ? topCenter : singleCenter;
      const settingsCenter = dualLeft || dualRight ? topCenter : singleCenter;
      const dateCenter = dualLeft || dualRight ? bottomCenter : singleCenter;
      const lensCenter = bottomCenter;
      const brandEdge = rtl ? W - pad : pad;
      const infoEdge = rtl ? pad : W - pad;

      // Brand group (logo optional — reference often shows camera text only)
      if (model || (options.showLogo && options.logo)) {
        ctx.font = `600 ${brandModelSize}px ${font}`;
        const sample = model || "Hg";
        const band = measureBand(ctx, sample, brandModelSize);
        const logoH = Math.max(1, Math.round(band.height));
        const groupTop = brandCenter - logoH / 2;
        const baseline = baselineAtCenter(brandCenter, band.ascent, band.descent);

        let brandW = model ? ctx.measureText(model).width : 0;
        if (options.showLogo && options.logo) {
          brandW += logoH * options.logo.aspect + gapXHalf + (model ? 1 + gapXHalf : 0);
        }
        let x = rtl ? brandEdge - brandW : brandEdge;

        if (options.showLogo && options.logo) {
          const logoW = await drawLogo(rc, x, groupTop, logoH, fg);
          x += logoW + gapXHalf;
          if (model) {
            ctx.fillStyle = "rgba(255,255,255,0.35)";
            const div = brandDividerY(groupTop, logoH);
            ctx.fillRect(x, div.y, 1, div.h);
            x += 1 + gapXHalf;
          }
        }

        if (model) {
          ctx.fillStyle = fg;
          ctx.font = `600 ${brandModelSize}px ${font}`;
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
          ctx.fillText(model, xForInkLeft(ctx, model, x), baseline);
        }
      }

      if (lens) {
        ctx.font = `400 ${dateSize}px ${font}`;
        const band = measureBand(ctx, lens, dateSize);
        ctx.fillStyle = muted;
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = rtl ? "right" : "left";
        ctx.fillText(lens, brandEdge, baselineAtCenter(lensCenter, band.ascent, band.descent));
      }

      const drawInfo = (
        parts: string[],
        centerY: number,
        size: number,
        weight: string,
        color: string,
        tokenGap: number,
      ) => {
        if (!parts.length) return;
        ctx.font = `${weight} ${size}px ${font}`;
        const band = measureBand(ctx, parts[0]!, size);
        const baseline = baselineAtCenter(centerY, band.ascent, band.descent);
        ctx.fillStyle = color;
        ctx.textBaseline = "alphabetic";
        if (rtl) {
          ctx.textAlign = "left";
          let x = infoEdge;
          for (let i = 0; i < parts.length; i++) {
            const part = parts[i]!;
            ctx.fillText(part, x, baseline);
            x += ctx.measureText(part).width + tokenGap;
          }
        } else {
          drawTokenRow(ctx, {
            parts,
            rightX: infoEdge,
            centerY,
            size,
            weight,
            font,
            color,
            tokenGap,
          });
        }
      };

      if (settings.length) {
        drawInfo(settings, settingsCenter, settingsSize, "600", fg, gapX);
      }

      if (dateParts.length && (dualLeft || dualRight)) {
        drawInfo(dateParts, dateCenter, dateSize, "400", muted, gapXHalf);
      } else if (dateParts.length && !settings.length) {
        drawInfo(dateParts, singleCenter, dateSize, "400", muted, gapXHalf);
      }

      if (withRule) {
        ctx.fillStyle = fg;
        ctx.fillRect(pad, H - pad, W - pad * 2, 1);
      }

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    },
  };
}

/**
 * Centered Overlay stack: logo → camera → details, bottom-center on the veil.
 * Ignores `captionDirection` (already centered).
 */
function createOverlayCenter(): TemplateRenderer {
  return {
    id: "overlay-center",
    name: "Overlay Center",
    description: "Full-bleed photo with centered stacked caption on a soft gradient",
    async render(rc) {
      const { ctx, canvas, image, imageWidth, imageHeight, exif, options } = rc;
      const font = defaultFont(options.fontFamily);
      const W = imageWidth;
      const H = imageHeight;
      const unit = Math.min(W, H);

      canvas.width = W;
      canvas.height = H;
      ctx.drawImage(image, 0, 0, W, H);
      drawVeil(ctx, W, H);

      const fields = activeFields(rc);
      const { pad, titleSize, subSize, gapY: rowGap } = overlaySpacing(unit);
      const fg = options.textColor ?? "#ffffff";
      const muted = options.accentColor ?? "rgba(255,255,255,0.75)";
      const centerX = W / 2;

      const camera = cameraLineFromContext(rc);
      const lens = lensLine(exif, fields);
      const settings = settingsLine(exif, fields);
      const dateText = statusDateTimeTokens(exif.dateTime, fields).join(" ");
      const details = [lens, settings, dateText].filter(Boolean).join("  ·  ");
      const showLogo = Boolean(options.showLogo && options.logo);

      ctx.font = `600 ${titleSize}px ${font}`;
      const titleBand = measureBand(ctx, camera || "Hg", titleSize);
      const logoH = showLogo ? Math.max(1, Math.round(titleBand.height)) : 0;
      const logoW = showLogo && options.logo ? logoH * options.logo.aspect : 0;

      type Row =
        | { kind: "logo"; size: number }
        | { kind: "name"; size: number; text: string }
        | { kind: "details"; size: number; text: string };
      const rows: Row[] = [];
      if (showLogo) rows.push({ kind: "logo", size: logoH });
      if (camera) rows.push({ kind: "name", size: titleSize, text: camera });
      if (details) {
        rows.push({ kind: "details", size: subSize, text: details });
      }
      if (!rows.length) return;

      const blockH = rows.reduce((sum, row) => sum + row.size, 0) + rowGap * (rows.length - 1);
      // Sit the stack on the bottom pad (same anchor as classic Overlay)
      let rowTop = H - pad - blockH;

      ctx.textBaseline = "alphabetic";
      for (const row of rows) {
        const centerY = rowTop + row.size / 2;
        if (row.kind === "logo" && options.logo) {
          await drawLogo(rc, centerX - logoW / 2, centerY - logoH / 2, logoH, fg);
        } else if (row.kind === "name") {
          ctx.font = `600 ${row.size}px ${font}`;
          const band = measureBand(ctx, row.text, row.size);
          ctx.fillStyle = fg;
          ctx.textAlign = "center";
          ctx.fillText(row.text, centerX, baselineAtCenter(centerY, band.ascent, band.descent));
        } else if (row.kind === "details") {
          ctx.font = `400 ${row.size}px ${font}`;
          const band = measureBand(ctx, row.text, row.size);
          ctx.fillStyle = muted;
          ctx.textAlign = "center";
          ctx.fillText(row.text, centerX, baselineAtCenter(centerY, band.ascent, band.descent));
        }
        rowTop += row.size + rowGap;
      }

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    },
  };
}

/**
 * iOS-like glass caption: Gallery White Lens content/sizing on a strip below
 * the photo. The strip is a blurred edge-color wash that eases out of the
 * photo itself; text color adapts to that mat.
 */
function createOverlayGlass(): TemplateRenderer {
  return {
    id: "overlay-glass",
    name: "Overlay Glass",
    description: "Photo with a blurred bottom extension; Gallery Lens caption + adaptive text",
    async render(rc) {
      const { ctx, canvas, image, imageWidth, imageHeight, exif, options } = rc;
      const font = defaultFont(options.fontFamily);
      const unit = Math.min(imageWidth, imageHeight);

      const { strip, gapX, gapXHalf, gapY, padX, settingsSize, dateSize, modelSize } =
        galleryStripForUnit(unit);
      const brandModelSize = galleryBrandModelSize({ modelSize, settingsSize }, true);
      const modelWeight = "600";

      const photoW = imageWidth;
      const photoH = imageHeight;
      const W = photoW;
      const H = photoH + strip;

      canvas.width = W;
      canvas.height = H;

      ctx.drawImage(image, 0, 0, photoW, photoH);
      await drawGlassExtendBlur(
        ctx,
        image,
        imageWidth,
        imageHeight,
        photoW,
        photoH,
        strip,
        "bottom",
        0,
      );

      const avg = sampleRectAverage(ctx, 0, photoH, W, strip);
      const adaptive = adaptiveCaptionColors(avg);
      const fg = options.textColor ?? adaptive.fg;
      const muted = options.accentColor ?? adaptive.muted;
      const divider = adaptive.divider;

      const fields = activeFields(rc);
      const model = cameraLineFromContext(rc);
      const lens = lensLine(exif, fields);
      const settings = settingsParts(exif, fields);
      const dateParts = statusDateTimeTokens(exif.dateTime, fields);

      const dualLeft = Boolean(lens);
      const dualRight = settings.length > 0 && dateParts.length > 0;
      const blockH = settingsSize + gapY + dateSize;
      // Caption centered in the extended strip (like Gallery status bar)
      const midY = photoH + strip / 2;
      const blockTop = midY - blockH / 2;
      const topCenter = blockTop + settingsSize / 2;
      const bottomCenter = blockTop + settingsSize + gapY + dateSize / 2;
      const singleCenter = midY;

      const rtl = options.captionDirection === "rtl";
      const brandCenter = dualLeft ? topCenter : singleCenter;
      const settingsCenter = dualLeft || dualRight ? topCenter : singleCenter;
      const dateCenter = dualLeft || dualRight ? bottomCenter : singleCenter;
      const lensCenter = bottomCenter;
      const brandEdge = rtl ? W - padX : padX;
      const infoEdge = rtl ? padX : W - padX;

      if (model || (options.showLogo && options.logo)) {
        ctx.font = `${modelWeight} ${brandModelSize}px ${font}`;
        const sample = model || "Hg";
        const band = measureBand(ctx, sample, brandModelSize);
        const logoH = Math.max(1, Math.round(band.height));
        const groupTop = brandCenter - logoH / 2;
        const baseline = baselineAtCenter(brandCenter, band.ascent, band.descent);

        let brandW = model ? ctx.measureText(model).width : 0;
        if (options.showLogo && options.logo) {
          brandW += logoH * options.logo.aspect + gapXHalf + (model ? 1 + gapXHalf : 0);
        }
        let x = rtl ? brandEdge - brandW : brandEdge;

        if (options.showLogo && options.logo) {
          const logoW = await drawLogo(rc, x, groupTop, logoH, fg);
          x += logoW + gapXHalf;
          if (model) {
            ctx.fillStyle = divider;
            const div = brandDividerY(groupTop, logoH);
            ctx.fillRect(x, div.y, 1, div.h);
            x += 1 + gapXHalf;
          }
        }

        if (model) {
          ctx.fillStyle = fg;
          ctx.font = `${modelWeight} ${brandModelSize}px ${font}`;
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
          ctx.fillText(model, xForInkLeft(ctx, model, x), baseline);
        }
      }

      if (lens) {
        ctx.font = `400 ${dateSize}px ${font}`;
        const band = measureBand(ctx, lens, dateSize);
        ctx.fillStyle = muted;
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = rtl ? "right" : "left";
        ctx.fillText(lens, brandEdge, baselineAtCenter(lensCenter, band.ascent, band.descent));
      }

      const drawInfo = (
        parts: string[],
        centerY: number,
        size: number,
        weight: string,
        color: string,
        tokenGap: number,
      ) => {
        if (!parts.length) return;
        ctx.font = `${weight} ${size}px ${font}`;
        const band = measureBand(ctx, parts[0]!, size);
        const baseline = baselineAtCenter(centerY, band.ascent, band.descent);
        ctx.fillStyle = color;
        ctx.textBaseline = "alphabetic";
        if (rtl) {
          ctx.textAlign = "left";
          let x = infoEdge;
          for (let i = 0; i < parts.length; i++) {
            const part = parts[i]!;
            ctx.fillText(part, x, baseline);
            x += ctx.measureText(part).width + tokenGap;
          }
        } else {
          drawTokenRow(ctx, {
            parts,
            rightX: infoEdge,
            centerY,
            size,
            weight,
            font,
            color,
            tokenGap,
          });
        }
      };

      if (settings.length) {
        drawInfo(settings, settingsCenter, settingsSize, "600", fg, gapX);
      }

      if (dateParts.length && (dualLeft || dualRight)) {
        drawInfo(dateParts, dateCenter, dateSize, "400", muted, gapXHalf);
      } else if (dateParts.length && !settings.length) {
        drawInfo(dateParts, singleCenter, dateSize, "400", muted, gapXHalf);
      }

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    },
  };
}

/**
 * Glass frame with time/date on a top strip; Gallery Lens caption (no
 * time/date) on the bottom strip.
 */
function createOverlayGlassDate(): TemplateRenderer {
  return {
    id: "overlay-glass-date",
    name: "Overlay Glass Date",
    description: "Top glass strip with time/date; bottom glass strip with Gallery Lens caption",
    async render(rc) {
      const { ctx, canvas, image, imageWidth, imageHeight, exif, options } = rc;
      const font = defaultFont(options.fontFamily);
      const unit = Math.min(imageWidth, imageHeight);

      const { strip, gapX, gapXHalf, gapY, padX, settingsSize, dateSize, modelSize } =
        galleryStripForUnit(unit);
      const brandModelSize = galleryBrandModelSize({ modelSize, settingsSize }, true);
      const modelWeight = "600";

      const photoW = imageWidth;
      const photoH = imageHeight;
      const topStrip = strip;
      const bottomStrip = strip;
      const W = photoW;
      const H = topStrip + photoH + bottomStrip;
      const photoY = topStrip;

      canvas.width = W;
      canvas.height = H;

      ctx.drawImage(image, 0, photoY, photoW, photoH);
      await drawGlassExtendBlur(
        ctx,
        image,
        imageWidth,
        imageHeight,
        photoW,
        photoH,
        topStrip,
        "top",
        photoY,
      );
      await drawGlassExtendBlur(
        ctx,
        image,
        imageWidth,
        imageHeight,
        photoW,
        photoH,
        bottomStrip,
        "bottom",
        photoY,
      );

      const fields = activeFields(rc);
      const rtl = options.captionDirection === "rtl";

      // —— Top: time / date (field toggles) ——
      const dateParts = statusDateTimeTokens(exif.dateTime, fields);
      if (dateParts.length) {
        const topAvg = sampleRectAverage(ctx, 0, 0, W, topStrip);
        const topColors = adaptiveCaptionColors(topAvg);
        const dateColor = options.accentColor ?? topColors.muted;
        const dateEdge = rtl ? padX : W - padX;
        const dateCenterY = topStrip / 2;

        ctx.font = `400 ${dateSize}px ${font}`;
        const band = measureBand(ctx, dateParts[0]!, dateSize);
        const baseline = baselineAtCenter(dateCenterY, band.ascent, band.descent);
        ctx.fillStyle = dateColor;
        ctx.textBaseline = "alphabetic";
        if (rtl) {
          ctx.textAlign = "left";
          let x = dateEdge;
          for (const part of dateParts) {
            ctx.fillText(part, x, baseline);
            x += ctx.measureText(part).width + gapXHalf;
          }
        } else {
          drawTokenRow(ctx, {
            parts: dateParts,
            rightX: dateEdge,
            centerY: dateCenterY,
            size: dateSize,
            weight: "400",
            font,
            color: dateColor,
            tokenGap: gapXHalf,
          });
        }
      }

      // —— Bottom: Gallery Lens caption without time/date ——
      const bottomAvg = sampleRectAverage(ctx, 0, photoY + photoH, W, bottomStrip);
      const adaptive = adaptiveCaptionColors(bottomAvg);
      const fg = options.textColor ?? adaptive.fg;
      const muted = options.accentColor ?? adaptive.muted;
      const divider = adaptive.divider;

      const model = cameraLineFromContext(rc);
      const lens = lensLine(exif, fields);
      const settings = settingsParts(exif, fields);

      const dualLeft = Boolean(lens);
      const blockH = settingsSize + gapY + dateSize;
      const midY = photoY + photoH + bottomStrip / 2;
      const blockTop = midY - blockH / 2;
      const topCenter = blockTop + settingsSize / 2;
      const bottomCenter = blockTop + settingsSize + gapY + dateSize / 2;
      const singleCenter = midY;

      const brandCenter = dualLeft ? topCenter : singleCenter;
      const settingsCenter = dualLeft ? topCenter : singleCenter;
      const lensCenter = bottomCenter;
      const brandEdge = rtl ? W - padX : padX;
      const infoEdge = rtl ? padX : W - padX;

      if (model || (options.showLogo && options.logo)) {
        ctx.font = `${modelWeight} ${brandModelSize}px ${font}`;
        const sample = model || "Hg";
        const band = measureBand(ctx, sample, brandModelSize);
        const logoH = Math.max(1, Math.round(band.height));
        const groupTop = brandCenter - logoH / 2;
        const baseline = baselineAtCenter(brandCenter, band.ascent, band.descent);

        let brandW = model ? ctx.measureText(model).width : 0;
        if (options.showLogo && options.logo) {
          brandW += logoH * options.logo.aspect + gapXHalf + (model ? 1 + gapXHalf : 0);
        }
        let x = rtl ? brandEdge - brandW : brandEdge;

        if (options.showLogo && options.logo) {
          const logoW = await drawLogo(rc, x, groupTop, logoH, fg);
          x += logoW + gapXHalf;
          if (model) {
            ctx.fillStyle = divider;
            const div = brandDividerY(groupTop, logoH);
            ctx.fillRect(x, div.y, 1, div.h);
            x += 1 + gapXHalf;
          }
        }

        if (model) {
          ctx.fillStyle = fg;
          ctx.font = `${modelWeight} ${brandModelSize}px ${font}`;
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
          ctx.fillText(model, xForInkLeft(ctx, model, x), baseline);
        }
      }

      if (lens) {
        ctx.font = `400 ${dateSize}px ${font}`;
        const band = measureBand(ctx, lens, dateSize);
        ctx.fillStyle = muted;
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = rtl ? "right" : "left";
        ctx.fillText(lens, brandEdge, baselineAtCenter(lensCenter, band.ascent, band.descent));
      }

      if (settings.length) {
        ctx.font = `600 ${settingsSize}px ${font}`;
        const band = measureBand(ctx, settings[0]!, settingsSize);
        const baseline = baselineAtCenter(settingsCenter, band.ascent, band.descent);
        ctx.fillStyle = fg;
        ctx.textBaseline = "alphabetic";
        if (rtl) {
          ctx.textAlign = "left";
          let x = infoEdge;
          for (let i = 0; i < settings.length; i++) {
            const part = settings[i]!;
            ctx.fillText(part, x, baseline);
            x += ctx.measureText(part).width + gapX;
          }
        } else {
          drawTokenRow(ctx, {
            parts: settings,
            rightX: infoEdge,
            centerY: settingsCenter,
            size: settingsSize,
            weight: "600",
            font,
            color: fg,
            tokenGap: gapX,
          });
        }
      }

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    },
  };
}

export const overlay = createOverlayClassic();
export const overlayCenter = createOverlayCenter();
export const overlayGallery = createOverlayGallery(false);
export const overlayGalleryLens = createOverlayGallery(true);
export const overlayRule = createOverlayGallery(true, true);
export const overlayGlass = createOverlayGlass();
export const overlayGlassDate = createOverlayGlassDate();
