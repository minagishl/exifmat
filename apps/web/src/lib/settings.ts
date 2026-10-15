import type { CaptionDirection, ExifField } from "exif-frame";

const STORAGE_KEY = "exif-frame:settings:v1";

/** Options remembered between visits. Per-photo data (EXIF edits, files) is not stored. */
export interface StoredSettings {
  template: string;
  showLogo: boolean;
  colorLogo: boolean;
  stripBrandFromModel: boolean;
  fields: ExifField[];
  quality: number;
  captionDirection: CaptionDirection;
  sidebarWidth: number;
}

/** Read stored settings, dropping anything missing or invalid. */
export function loadSettings(
  validTemplates: readonly string[],
  allFields: readonly ExifField[],
): Partial<StoredSettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<StoredSettings> = {};

    if (typeof data.template === "string" && validTemplates.includes(data.template)) {
      out.template = data.template;
    }
    for (const key of ["showLogo", "colorLogo", "stripBrandFromModel"] as const) {
      if (typeof data[key] === "boolean") out[key] = data[key];
    }
    if (Array.isArray(data.fields)) {
      const known = new Set<string>(allFields);
      out.fields = allFields.filter((f) => (data.fields as unknown[]).includes(f) && known.has(f));
    }
    if (typeof data.quality === "number" && data.quality >= 0.5 && data.quality <= 1) {
      out.quality = data.quality;
    }
    if (data.captionDirection === "ltr" || data.captionDirection === "rtl") {
      out.captionDirection = data.captionDirection;
    }
    if (typeof data.sidebarWidth === "number" && Number.isFinite(data.sidebarWidth)) {
      out.sidebarWidth = data.sidebarWidth;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveSettings(settings: StoredSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable (private mode, quota) — settings just won't persist */
  }
}
