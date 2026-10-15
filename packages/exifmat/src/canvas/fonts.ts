import { accessSync, constants } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FAMILY = "Inter Variable";

let registered = false;

function candidatePaths(): string[] {
  const here =
    typeof import.meta.dir === "string" ? import.meta.dir : dirname(fileURLToPath(import.meta.url));

  return [
    // src/canvas or dist/canvas → ../../assets/fonts
    join(here, "../../assets/fonts/InterVariable.ttf"),
    join(process.cwd(), "assets/fonts/InterVariable.ttf"),
    join(process.cwd(), "packages/exifmat/assets/fonts/InterVariable.ttf"),
  ];
}

function findInterFontFile(): string | null {
  for (const path of candidatePaths()) {
    try {
      accessSync(path, constants.R_OK);
      return path;
    } catch {
      // try next
    }
  }
  return null;
}

/**
 * Register Inter Variable with @napi-rs/canvas for Node/Bun rendering.
 * Safe to call multiple times; no-op in the browser.
 */
export async function ensureInterFontRegistered(): Promise<boolean> {
  if (registered) return true;
  if (typeof document !== "undefined") return false;

  try {
    const { GlobalFonts } = await import("@napi-rs/canvas");
    if (!GlobalFonts.has(FAMILY)) {
      const fontPath = findInterFontFile();
      if (!fontPath) {
        console.warn("[exifmat] InterVariable.ttf not found; canvas text will use system fonts");
        return false;
      }

      const key = GlobalFonts.registerFromPath(fontPath, FAMILY);
      if (!key) {
        console.warn("[exifmat] Failed to register Inter Variable font");
        return false;
      }
    }

    // Allow both CSS name and short name in fontFamily stacks
    GlobalFonts.setAlias(FAMILY, "Inter");
    registered = true;
    return true;
  } catch {
    // @napi-rs/canvas missing or register failed
    return false;
  }
}
