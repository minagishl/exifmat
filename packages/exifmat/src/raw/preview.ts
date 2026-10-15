import exifr from "exifr";
import { isDecodableRaster, isRawBytes } from "./formats";
import { largestEmbeddedJpeg } from "./jpeg";

export interface PreviewResult {
  /** JPEG (or other raster) bytes suitable for canvas decoding */
  bytes: Uint8Array;
  /** True when the display image came from an embedded RAW preview */
  fromRawPreview: boolean;
}

/**
 * Resolve canvas-decodable image bytes from a photo or camera RAW file.
 *
 * RAW files (CR3, NEF, ARW, DNG, …) are not demosaiced. Instead the largest
 * embedded JPEG preview is extracted — fast and works in browser + Node.
 */
export async function resolvePreviewBytes(
  data: Uint8Array,
  filename?: string | null,
): Promise<PreviewResult> {
  if (isDecodableRaster(data)) {
    return { bytes: data, fromRawPreview: false };
  }

  const treatAsRaw = isRawBytes(data, filename);

  // Prefer the largest embedded JPEG (full-size preview in CR3/NEF/ARW/…)
  const embedded = largestEmbeddedJpeg(data, {
    minSize: treatAsRaw ? 4_096 : 8_192,
  });
  if (embedded) {
    return { bytes: copyBytes(embedded), fromRawPreview: true };
  }

  // Fallback: IFD1 thumbnail via exifr
  try {
    const thumb = await exifr.thumbnail(data);
    if (thumb && thumb.byteLength >= 512) {
      return {
        bytes: copyBytes(thumb instanceof Uint8Array ? thumb : new Uint8Array(thumb)),
        fromRawPreview: true,
      };
    }
  } catch {
    // ignore
  }

  if (treatAsRaw) {
    throw new Error(
      `Could not extract a JPEG preview from RAW file${filename ? ` "${filename}"` : ""}. ` +
        "The file may not contain an embedded preview.",
    );
  }

  // Not RAW and not a known raster — let the canvas loader try / fail
  return { bytes: data, fromRawPreview: false };
}

function copyBytes(src: Uint8Array): Uint8Array {
  const out = new Uint8Array(src.byteLength);
  out.set(src);
  return out;
}

export { isRawBytes, isRawExtension, RAW_EXTENSIONS } from "./formats";
