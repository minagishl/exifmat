import type { LogoAsset, NormalizedExif } from "../types";
import { MAKE_MATCHERS } from "./catalog";
import { LOGO_SVGS } from "./svgs";

const logoCache = new Map<string, LogoAsset>();

/**
 * Marks built as a colored shape with white lettering. A flat tint would fill
 * the whole shape, so their white parts are cut out of it instead.
 */
const KNOCKOUT_IDS = new Set(["leica", "xiaomi"]);

const WHITE_SHAPE =
  /<(?:path|circle|rect|ellipse|polygon)\b[^>]*\bfill="(?:#fff(?:fff)?|white)"[^>]*>/gi;
const KNOCKOUT_MASK_ID = "exif-frame-knockout";

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

/**
 * Tint SVG for frame backgrounds: mono by default, original brand fills when
 * `colorLogo` is set. Shapes with no fill of their own (SVG's default is black)
 * always follow `color`, so they stay visible on dark frames.
 */
function tintSvg(svg: string, color: string, id: string, colorLogo = false): string {
  // Always resolve currentColor so the logo is drawable on any background
  let out = svg.replace(/currentColor/g, color);
  out = out.replace(/<svg\b([^>]*)>/i, (tag, attrs: string) =>
    /\sfill=/.test(attrs) ? tag : `<svg${attrs} fill="${color}">`,
  );
  if (colorLogo) return out;

  const holes: string[] = [];
  if (KNOCKOUT_IDS.has(id)) {
    out = out.replace(WHITE_SHAPE, (shape) => {
      holes.push(shape);
      return "";
    });
  }

  out = out.replace(/\bfill=("(?!none|url\()[^"]*"|'(?!none|url\()[^']*')/gi, `fill="${color}"`);
  out = out.replace(
    /\bstroke=("(?!none|url\()[^"]*"|'(?!none|url\()[^']*')/gi,
    `stroke="${color}"`,
  );
  out = out.replace(/fill\s*:\s*(?!none|url\()[^;"}<]+/gi, `fill:${color}`);
  out = out.replace(/stroke\s*:\s*(?!none|url\()[^;"}<]+/gi, `stroke:${color}`);
  // CSS classes like .st0{fill:#414042}
  out = out.replace(/(\.|#)[a-zA-Z0-9_-]+\s*\{[^}]*\bfill\s*:\s*(?!none|url\()[^;}]*/gi, (block) =>
    block.replace(/fill\s*:\s*(?!none|url\()[^;}]*/gi, `fill:${color}`),
  );

  if (holes.length > 0) {
    const cut = holes.map((shape) => shape.replace(/\bfill="[^"]*"/i, 'fill="#000"')).join("");
    const mask =
      `<mask id="${KNOCKOUT_MASK_ID}" maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000">` +
      `<rect x="-100000" y="-100000" width="200000" height="200000" fill="#fff"/>${cut}</mask>`;
    out = out
      .replace(/(<svg\b[^>]*>)/i, `$1${mask}<g mask="url(#${KNOCKOUT_MASK_ID})">`)
      .replace(/<\/svg>\s*$/i, "</g></svg>");
  }
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
