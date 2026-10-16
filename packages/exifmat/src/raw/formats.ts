/** Common camera RAW extensions */
export const RAW_EXTENSIONS = [
  "cr2",
  "cr3",
  "crw",
  "nef",
  "nrw",
  "arw",
  "srf",
  "sr2",
  "dng",
  "orf",
  "rw2",
  "raf",
  "pef",
  "ptx",
  "srw",
  "raw",
  "rwl",
  "erf",
  "3fr",
  "fff",
  "iiq",
  "kdc",
  "dcr",
  "mos",
  "mrw",
  "x3f",
  "bay",
  "cap",
] as const;

const RAW_EXT_RE = new RegExp(`\\.(${RAW_EXTENSIONS.join("|")})$`, "i");

export function extensionOf(name?: string | null): string | undefined {
  if (!name) return undefined;
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  return m?.[1]?.toLowerCase();
}

export function isRawExtension(name?: string | null): boolean {
  if (!name) return false;
  return RAW_EXT_RE.test(name);
}

function readAscii(bytes: Uint8Array, offset: number, len: number): string {
  let s = "";
  for (let i = 0; i < len && offset + i < bytes.length; i++) {
    s += String.fromCharCode(bytes[offset + i]!);
  }
  return s;
}

/** Detect RAW (or TIFF-container RAW) from magic bytes */
export function detectRawMagic(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;

  // BMFF containers: CR3 (crx). HEIC/HEIF/AVIF are regular images, see `heifBrand`.
  if (readAscii(bytes, 4, 4) === "ftyp") {
    const brand = readAscii(bytes, 8, 4).trim();
    if (brand.startsWith("crx")) return true;
  }

  // Fujifilm RAF
  if (readAscii(bytes, 0, 15) === "FUJIFILMCCD-RAW") return true;
  if (readAscii(bytes, 0, 8) === "FUJIFILM") return true;

  // TIFF-based RAW (CR2, NEF, ARW, DNG, ORF, PEF, RW2, …)
  const isTiff =
    (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
    (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a) ||
    // BigTIFF
    (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2b && bytes[3] === 0x00) ||
    (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2b);

  if (isTiff) {
    // Plain baseline TIFF/DNG may still need a JPEG preview for canvas decode
    return true;
  }

  // Panasonic RW2 often starts with TIFF II
  // Minolta MRW
  if (readAscii(bytes, 0, 4) === "\x00MRM") return true;

  return false;
}

export type HeifBrand = "heic" | "avif";

const HEIC_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "mif1",
  "msf1",
  "heif",
]);
const AVIF_BRANDS = new Set(["avif", "avis"]);

/** Detect HEIC/HEIF and AVIF (ISO BMFF image containers) from the `ftyp` box. */
export function heifBrand(bytes: Uint8Array): HeifBrand | null {
  if (bytes.length < 12 || readAscii(bytes, 4, 4) !== "ftyp") return null;
  const brand = readAscii(bytes, 8, 4).trim();
  if (AVIF_BRANDS.has(brand)) return "avif";
  if (HEIC_BRANDS.has(brand)) return "heic";
  return null;
}

/** True when bytes look like a canvas-decodable raster (JPEG/PNG/WebP/GIF/BMP) */
export function isDecodableRaster(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return true;
  }
  // GIF
  if (readAscii(bytes, 0, 3) === "GIF") return true;
  // BMP
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return true;
  // WebP
  if (readAscii(bytes, 0, 4) === "RIFF" && readAscii(bytes, 8, 4) === "WEBP") {
    return true;
  }
  return false;
}

export function isRawBytes(bytes: Uint8Array, filename?: string | null): boolean {
  if (isRawExtension(filename)) return true;
  if (isDecodableRaster(bytes) || heifBrand(bytes)) return false;
  return detectRawMagic(bytes);
}
