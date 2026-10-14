import type { LogoAsset, NormalizedExif } from "../types";
import { MAKE_MATCHERS } from "./catalog";
import { LOGO_SVGS } from "./svgs";

const logoCache = new Map<string, LogoAsset>();

/** Brands that keep official multi-color fills when tinting for frames */
const PRESERVE_COLORS = new Set(["google", "fujifilm", "leica", "gopro", "xiaomi"]);

function buildLogo(id: string): LogoAsset | null {
  const entry = LOGO_SVGS[id];
  if (!entry) return null;
  if (logoCache.has(id)) return logoCache.get(id)!;
  const asset: LogoAsset = {
    id,
    name: entry.name,
    svg: entry.svg,
    aspect: entry.aspect,
  };
  logoCache.set(id, asset);
  return asset;
}

/** Resolve a manufacturer logo from EXIF make/model strings */
export function resolveLogo(exif: NormalizedExif): LogoAsset | null {
  const haystack = `${exif.makeRaw ?? exif.make ?? ""} ${exif.model ?? ""}`;
  if (!haystack.trim()) return null;

  for (const matcher of MAKE_MATCHERS) {
    if (matcher.patterns.some((re) => re.test(haystack))) {
      return buildLogo(matcher.id);
    }
  }
  return null;
}

/** List all bundled manufacturer logos */
export function listLogos(): LogoAsset[] {
  return Object.keys(LOGO_SVGS)
    .map((id) => buildLogo(id)!)
    .filter(Boolean);
}

export const logos = {
  resolve: resolveLogo,
  list: listLogos,
  get: buildLogo,
};

function toBase64(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  if (typeof btoa === "function") {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }
  return Buffer.from(bytes).toString("base64");
}

function looksLikeSvgMarkup(value: string): boolean {
  const t = value.trimStart();
  return t.startsWith("<svg") || t.startsWith("<?xml");
}

export interface LoadLogoOptions {
  /** Keep original brand fills instead of mono tint */
  colorLogo?: boolean;
}

/** Tint SVG for frame backgrounds (mono), unless brand colors should be kept */
function tintSvg(svg: string, color: string, id: string, colorLogo = false): string {
  // Always resolve currentColor so the logo is drawable on any background
  let out = svg.replace(/currentColor/g, color);
  if (colorLogo || PRESERVE_COLORS.has(id)) return out;

  out = out.replace(/\bfill=("(?!none|url\()[^"]*"|'(?!none|url\()[^']*')/gi, `fill="${color}"`);
  out = out.replace(
    /\bstroke=("(?!none|url\()[^"]*"|'(?!none|url\()[^']*')/gi,
    `stroke="${color}"`,
  );
  out = out.replace(/fill\s*:\s*(?!none|url\()[^;"]+/gi, `fill:${color}`);
  out = out.replace(/stroke\s*:\s*(?!none|url\()[^;"]+/gi, `stroke:${color}`);
  // CSS classes like .st0{fill:#414042}
  out = out.replace(/(\.|#)[a-zA-Z0-9_-]+\s*\{[^}]*\bfill\s*:\s*(?!none|url\()[^;}]*/gi, (block) =>
    block.replace(/fill\s*:\s*(?!none|url\()[^;}]*/gi, `fill:${color}`),
  );
  return out;
}

async function resolveSvgMarkup(logo: LogoAsset): Promise<string> {
  const raw = logo.svg;
  if (looksLikeSvgMarkup(raw)) return raw;

  // Vite may hand us an asset URL instead of file contents
  if (typeof fetch === "function") {
    const res = await fetch(raw);
    if (!res.ok) {
      throw new Error(`Failed to fetch logo SVG (${res.status})`);
    }
    const text = await res.text();
    if (!looksLikeSvgMarkup(text)) {
      throw new Error("Logo asset did not resolve to SVG markup");
    }
    return text;
  }

  throw new Error("Logo SVG markup missing");
}

/**
 * Load an SVG logo into a canvas-drawable image.
 * Works in browser (Image) and Node/Bun (@napi-rs/canvas loadImage).
 * Uses base64 data URLs — more reliable for native canvas SVG decoders.
 */
export async function loadLogoImage(
  logo: LogoAsset,
  color: string,
  loadImage: (src: string) => Promise<CanvasImageSource>,
  options?: LoadLogoOptions,
): Promise<CanvasImageSource> {
  const markup = await resolveSvgMarkup(logo);
  const colored = tintSvg(markup, color, logo.id, options?.colorLogo);
  const dataUrl = `data:image/svg+xml;base64,${toBase64(colored)}`;
  return loadImage(dataUrl);
}

export { MAKE_MATCHERS } from "./catalog";
export { LOGO_SVGS };
