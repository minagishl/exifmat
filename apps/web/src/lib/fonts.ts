import { DEFAULT_FONT_FAMILY } from "exifmat";

/** Canvas / CSS font stack — same as the library default (Inter Variable) */
export const FRAME_FONT_FAMILY = DEFAULT_FONT_FAMILY;

/** Ensure variable Inter is ready before canvas text measurement/draw */
export async function ensureFontsLoaded(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.load) return;
  try {
    await Promise.all([
      document.fonts.load(`400 16px ${FRAME_FONT_FAMILY}`),
      document.fonts.load(`500 16px ${FRAME_FONT_FAMILY}`),
      document.fonts.load(`600 16px ${FRAME_FONT_FAMILY}`),
      document.fonts.load(`700 16px ${FRAME_FONT_FAMILY}`),
    ]);
    await document.fonts.ready;
  } catch {
    // Canvas will fall back to system sans if load fails
  }
}
