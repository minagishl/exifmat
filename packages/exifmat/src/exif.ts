import exifr from "exifr";
import type { ExifOverride, ImageInput, NormalizedExif } from "./types";

function formatAperture(value: unknown): string | undefined {
  if (value == null) return undefined;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `f/${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)}`;
}

function formatShutter(value: unknown): string | undefined {
  if (value == null) return undefined;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (n >= 1) return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)}s`;
  const denom = Math.round(1 / n);
  return `1/${denom}s`;
}

function formatFocalLength(value: unknown): string | undefined {
  if (value == null) return undefined;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  const rounded = Math.round(n * 10) / 10;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}mm`;
}

function formatIso(value: unknown): string | undefined {
  if (value == null) return undefined;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return `ISO ${value}`;
  return `ISO ${Math.round(n)}`;
}

function formatDateTime(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) {
    return value.toISOString().replace("T", " ").slice(0, 19);
  }
  return String(value);
}

function pickLens(raw: Record<string, unknown>): string | undefined {
  const candidates = [
    raw.LensModel,
    raw.Lens,
    raw.LensInfo,
    raw.LensMake && raw.LensModel ? `${raw.LensMake} ${raw.LensModel}` : undefined,
  ];
  for (const c of candidates) {
    if (c != null && String(c).trim()) return String(c).trim();
  }
  return undefined;
}

async function toParsable(
  input: ImageInput,
): Promise<File | Blob | ArrayBuffer | Uint8Array | string> {
  if (typeof input === "string") return input;
  if (input instanceof ArrayBuffer || input instanceof Uint8Array) return input;
  if (typeof Blob !== "undefined" && input instanceof Blob) return input;
  if (typeof HTMLImageElement !== "undefined" && input instanceof HTMLImageElement) {
    // Prefer original file via src only when same-origin data URL / blob
    if (input.src) return input.src;
  }
  if (typeof ImageBitmap !== "undefined" && input instanceof ImageBitmap) {
    throw new Error(
      "Cannot parse EXIF from ImageBitmap. Pass the original File, Blob, or ArrayBuffer instead.",
    );
  }
  throw new Error("Unsupported image input for EXIF parsing");
}

/** Drop undefined keys so overrides cannot wipe parsed EXIF values */
function compactOverride(override?: ExifOverride): ExifOverride | undefined {
  if (!override) return undefined;
  const out: ExifOverride = {};
  for (const [key, value] of Object.entries(override) as Array<
    [keyof ExifOverride, ExifOverride[keyof ExifOverride]]
  >) {
    if (value !== undefined && value !== "") out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Parse and normalize EXIF metadata from an image source.
 */
export async function parseExif(
  input: ImageInput,
  override?: ExifOverride,
): Promise<NormalizedExif> {
  let raw: Record<string, unknown> | undefined;

  try {
    const parsable = await toParsable(input);
    // translateKeys must stay true — otherwise keys are numeric tag IDs (271, …)
    raw = (await exifr.parse(parsable, {
      pick: [
        "Make",
        "Model",
        "LensModel",
        "Lens",
        "LensInfo",
        "LensMake",
        "FocalLength",
        "FNumber",
        "ExposureTime",
        "ISO",
        "ISOSpeedRatings",
        "PhotographicSensitivity",
        "DateTimeOriginal",
        "CreateDate",
      ],
      translateKeys: true,
      reviveValues: true,
      sanitize: false,
    })) as Record<string, unknown> | undefined;
  } catch {
    raw = undefined;
  }

  const make = raw?.Make != null ? String(raw.Make).trim() : undefined;
  const model = raw?.Model != null ? String(raw.Model).trim() : undefined;

  const normalized: NormalizedExif = {
    make,
    model,
    makeRaw: make,
    lens: pickLens(raw ?? {}),
    focalLength: formatFocalLength(raw?.FocalLength),
    aperture: formatAperture(raw?.FNumber),
    shutterSpeed: formatShutter(raw?.ExposureTime),
    iso: formatIso(raw?.ISO ?? raw?.ISOSpeedRatings ?? raw?.PhotographicSensitivity),
    dateTime: formatDateTime(raw?.DateTimeOriginal ?? raw?.CreateDate),
  };

  const cleaned = compactOverride(override);
  if (cleaned) {
    return { ...normalized, ...cleaned };
  }
  return normalized;
}

const SETTINGS_FIELD_ORDER = ["focalLength", "aperture", "shutter", "iso"] as const;

/** Build a compact settings line like "50mm · f/1.8 · 1/200s · ISO 400" */
export function formatSettingsLine(
  exif: NormalizedExif,
  fields: Array<"focalLength" | "aperture" | "shutter" | "iso">,
): string {
  const enabled = new Set(fields);
  const parts: string[] = [];
  // Always emit in canonical order, regardless of `fields` array order
  for (const field of SETTINGS_FIELD_ORDER) {
    if (!enabled.has(field)) continue;
    if (field === "focalLength" && exif.focalLength) parts.push(exif.focalLength);
    else if (field === "aperture" && exif.aperture) parts.push(exif.aperture);
    else if (field === "shutter" && exif.shutterSpeed) parts.push(exif.shutterSpeed);
    else if (field === "iso" && exif.iso) parts.push(exif.iso);
  }
  return parts.join(" · ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Remove leading brand tokens from a model string.
 * e.g. make "Canon", model "Canon EOS R7" → "EOS R7"
 */
export function stripBrandFromModel(
  model: string | undefined,
  make: string | undefined,
  extraBrandNames: string[] = [],
): string {
  const original = model?.trim() || make?.trim() || "";
  if (!model?.trim()) return original;

  const brands = new Set<string>();
  if (make?.trim()) {
    const m = make.trim();
    brands.add(m);
    for (const token of m.split(/[\s,_./-]+/)) {
      if (token.length >= 2) brands.add(token);
    }
  }
  for (const name of extraBrandNames) {
    if (name?.trim()) brands.add(name.trim());
  }

  let out = model.trim();
  const sorted = [...brands].sort((a, b) => b.length - a.length);
  for (const brand of sorted) {
    const re = new RegExp(`^${escapeRegExp(brand)}(?:[\\s\\-_./]+|$)`, "i");
    const next = out.replace(re, "").trim();
    if (next && next !== out) out = next;
  }

  // Drop leftover leading separators
  out = out.replace(/^[\s\-_./]+/, "").trim();
  return out || original;
}

/** Camera label: prefer "Make Model", fall back to either */
export function formatCamera(
  exif: NormalizedExif,
  options?: { stripBrand?: boolean; brandNames?: string[] },
): string {
  if (options?.stripBrand) {
    return stripBrandFromModel(exif.model, exif.make ?? exif.makeRaw, options.brandNames);
  }

  if (exif.make && exif.model) {
    const makeLower = exif.make.toLowerCase();
    const modelLower = exif.model.toLowerCase();
    if (modelLower.includes(makeLower.split(/\s+/)[0]!)) {
      return exif.model;
    }
    return `${exif.make} ${exif.model}`;
  }
  return exif.model ?? exif.make ?? "";
}
