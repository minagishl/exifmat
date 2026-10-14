import type {
  CreateFrameInput,
  CreateFrameOptions,
  ExifField,
  FrameResult,
  NormalizedExif,
} from "./types";
import { parseExif } from "./exif";
import { resolveLogo } from "./logos";
import { getCanvasEnvironment } from "./canvas";
import { getTemplate, listTemplates } from "./templates";
import { defaultFont } from "./templates/utils";
import { filenameFromInput, toUint8Array } from "./bytes";
import { resolvePreviewBytes } from "./raw";

/** Canonical field order / library default (time + date on). */
const DEFAULT_FIELDS: ExifField[] = [
  "camera",
  "lens",
  "focalLength",
  "aperture",
  "shutter",
  "iso",
  "time",
  "date",
];

/** Clamp JPEG quality to the valid 0–1 range (default 0.92). */
function resolveQuality(value?: number): number {
  if (value == null || Number.isNaN(value)) return 0.92;
  return Math.min(1, Math.max(0, value));
}

/** Keep enabled fields in canonical display order. */
function normalizeFields(fields?: ExifField[]): ExifField[] {
  const selected = new Set(fields ?? DEFAULT_FIELDS);
  return DEFAULT_FIELDS.filter((field) => selected.has(field));
}

function mergeOptions(
  options?: CreateFrameOptions,
): Required<
  Pick<
    CreateFrameOptions,
    | "showLogo"
    | "colorLogo"
    | "stripBrandFromModel"
    | "captionDirection"
    | "fields"
    | "fontFamily"
    | "quality"
  >
> &
  CreateFrameOptions {
  return {
    showLogo: options?.showLogo ?? true,
    colorLogo: options?.colorLogo ?? false,
    stripBrandFromModel: options?.stripBrandFromModel ?? true,
    fontFamily: defaultFont(options?.fontFamily),
    ...options,
    captionDirection: options?.captionDirection === "rtl" ? "rtl" : "ltr",
    fields: normalizeFields(options?.fields),
    quality: resolveQuality(options?.quality),
  };
}

function scaleDimensions(
  width: number,
  height: number,
  maxWidth?: number,
): { width: number; height: number; scale: number } {
  if (!maxWidth || width <= maxWidth) {
    return { width, height, scale: 1 };
  }
  const scale = maxWidth / width;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
    scale,
  };
}

/** List built-in and registered template ids */
export function availableTemplates(): string[] {
  return listTemplates().map((t) => t.id);
}

/**
 * Generate an EXIF frame image from a photo.
 *
 * Camera RAW files (CR3, NEF, ARW, DNG, …) are supported via their embedded
 * JPEG preview — metadata is still read from the original RAW container.
 */
export async function createFrame(input: CreateFrameInput): Promise<FrameResult> {
  const templateId = input.template ?? "gallery-dark";
  const template = getTemplate(templateId);
  if (!template) {
    throw new Error(
      `Unknown template "${templateId}". Available: ${availableTemplates().join(", ")}`,
    );
  }

  const options = mergeOptions(input.options);
  const env = await getCanvasEnvironment();
  const filename = filenameFromInput(input.image, input.filename);

  // Prefer byte access so RAW preview extraction and EXIF share one read
  let sourceBytes: Uint8Array | null = null;
  try {
    sourceBytes = await toUint8Array(input.image);
  } catch {
    sourceBytes = null;
  }

  const preview = sourceBytes ? await resolvePreviewBytes(sourceBytes, filename) : null;

  const exifPromise = (async () => {
    let parsed = sourceBytes
      ? await parseExif(sourceBytes, options.exif)
      : await parseExif(input.image, options.exif);

    // Some RAW containers expose little EXIF to parsers; fall back to preview JPEG tags
    if (
      preview?.fromRawPreview &&
      !options.exif &&
      !parsed.make &&
      !parsed.model &&
      !parsed.aperture
    ) {
      const fromPreview = await parseExif(preview.bytes);
      parsed = { ...fromPreview, ...parsed };
    }
    return parsed;
  })();

  const loadOpts = { maxWidth: options.maxWidth };

  const [exif, loaded] = await Promise.all([
    exifPromise,
    preview
      ? env.loadImage(preview.bytes, loadOpts)
      : env.loadImage(input.image, loadOpts).catch(async (err) => {
          if (!sourceBytes) throw err;
          const fallback = await resolvePreviewBytes(sourceBytes, filename);
          return env.loadImage(fallback.bytes, loadOpts);
        }),
  ]);

  if (loaded.width < 1 || loaded.height < 1) {
    throw new Error("Decoded image has zero dimensions");
  }

  // loadImage already respects maxWidth / canvas caps; keep a safety downscale
  const scaled = scaleDimensions(loaded.width, loaded.height, options.maxWidth);
  let image: CanvasImageSource = loaded.image;
  let imageWidth = loaded.width;
  let imageHeight = loaded.height;

  if (scaled.scale !== 1) {
    const tmp = env.createCanvas(scaled.width, scaled.height);
    const tctx = tmp.getContext("2d");
    if (!tctx) throw new Error("Failed to create scaling context");
    tctx.drawImage(loaded.image, 0, 0, scaled.width, scaled.height);
    image = tmp.asImageSource();
    imageWidth = scaled.width;
    imageHeight = scaled.height;
  }

  const logo = options.showLogo ? resolveLogo(exif) : null;

  const canvas = env.createCanvas(imageWidth, imageHeight);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to acquire 2D canvas context");

  await template.render({
    ctx,
    canvas,
    image,
    imageWidth,
    imageHeight,
    exif,
    options: {
      ...options,
      showLogo: options.showLogo,
      colorLogo: options.colorLogo,
      stripBrandFromModel: options.stripBrandFromModel,
      fields: options.fields,
      fontFamily: options.fontFamily,
      logo,
    },
  });

  const quality = options.quality;

  const result: FrameResult = {
    canvas,
    exif,
    template: templateId,
    width: canvas.width,
    height: canvas.height,
    toDataURL(type = "image/jpeg", q = quality) {
      return canvas.toDataURL(type, q);
    },
    async toBlob(type = "image/jpeg", q = quality) {
      if (canvas.convertToBlob) {
        return canvas.convertToBlob({ type, quality: q });
      }
      const buffer = await result.toBuffer(type, q);
      const copy = new Uint8Array(buffer.byteLength);
      copy.set(buffer);
      return new Blob([copy], { type });
    },
    async toBuffer(type = "image/png", q = quality) {
      if (canvas.toBuffer) {
        const out = canvas.toBuffer(type, q);
        return out instanceof Promise ? out : out;
      }
      const dataUrl = canvas.toDataURL(type, q);
      const base64 = dataUrl.split(",")[1] ?? "";
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    },
  };

  return result;
}

export type { NormalizedExif, CreateFrameInput, CreateFrameOptions, FrameResult };
