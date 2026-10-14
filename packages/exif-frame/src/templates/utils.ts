import type { ExifField, NormalizedExif, TemplateRenderContext } from "../types";
import { formatCamera, formatSettingsLine } from "../exif";
import { loadLogoImage } from "../logos";
import { getCanvasEnvironment } from "../canvas";
import { statusDateTimeTokens } from "./layout";

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
  srcW: number,
  srcH: number,
): void {
  const scale = Math.max(w / srcW, h / srcH);
  const dw = srcW * scale;
  const dh = srcH * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(image, dx, dy, dw, dh);
}

export function drawContainImage(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
  srcW: number,
  srcH: number,
): { x: number; y: number; w: number; h: number } {
  const scale = Math.min(w / srcW, h / srcH);
  const dw = srcW * scale;
  const dh = srcH * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(image, dx, dy, dw, dh);
  return { x: dx, y: dy, w: dw, h: dh };
}

export function activeFields(ctx: TemplateRenderContext): ExifField[] {
  return ctx.options.fields;
}

export function cameraLine(
  exif: NormalizedExif,
  fields: ExifField[],
  options?: {
    stripBrand?: boolean;
    brandNames?: string[];
  },
): string {
  if (!fields.includes("camera")) return "";
  return formatCamera(exif, options);
}

/** Strip brand from model when logo is visible and the option is enabled */
export function cameraLineFromContext(renderCtx: TemplateRenderContext): string {
  const { exif, options } = renderCtx;
  const fields = activeFields(renderCtx);
  const stripBrand =
    Boolean(options.showLogo && options.logo) && options.stripBrandFromModel !== false;
  return cameraLine(exif, fields, {
    stripBrand,
    brandNames: options.logo ? [options.logo.name] : undefined,
  });
}

export function lensLine(exif: NormalizedExif, fields: ExifField[]): string {
  if (!fields.includes("lens")) return "";
  return exif.lens ?? "";
}

export function settingsLine(exif: NormalizedExif, fields: ExifField[]): string {
  const settingFields = fields.filter(
    (f): f is "focalLength" | "aperture" | "shutter" | "iso" =>
      f === "focalLength" || f === "aperture" || f === "shutter" || f === "iso",
  );
  return formatSettingsLine(exif, settingFields);
}

export function dateLine(exif: NormalizedExif, fields: ExifField[]): string {
  return statusDateTimeTokens(exif.dateTime, fields).join(" ");
}

export async function drawLogo(
  renderCtx: TemplateRenderContext,
  x: number,
  y: number,
  height: number,
  color: string,
): Promise<number> {
  const logo = renderCtx.options.logo;
  if (!renderCtx.options.showLogo || !logo) return 0;

  const width = height * logo.aspect;
  try {
    const envLoad = async (src: string) => {
      // Prefer DOM Image when available (browser)
      if (typeof Image !== "undefined") {
        const img = new Image();
        img.decoding = "async";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("logo load failed"));
          img.src = src;
        });
        await img.decode().catch(() => undefined);
        return img;
      }
      const env = await getCanvasEnvironment();
      return env.loadImageFromUrl(src);
    };

    const img = await loadLogoImage(logo, color, envLoad, {
      colorLogo: renderCtx.options.colorLogo,
    });
    renderCtx.ctx.drawImage(img, x, y, width, height);
    return width;
  } catch {
    // Keep layout stable: reserve logo width, skip text fallback (avoids
    // overlapping the camera line with a duplicate brand name).
    return width;
  }
}

export function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxSize: number,
  minSize: number,
  family: string,
  weight = "500",
): number {
  let size = maxSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 1;
  }
  return minSize;
}

/** Shared stack for browser (Fontsource) and Node (GlobalFonts InterVariable.ttf) */
export const DEFAULT_FONT_FAMILY =
  '"Inter Variable", Inter, "Helvetica Neue", Helvetica, Arial, sans-serif';

export function defaultFont(family?: string): string {
  return family ?? DEFAULT_FONT_FAMILY;
}
