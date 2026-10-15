/**
 * Extract embedded JPEG payloads from a binary container (RAW, TIFF, CR3, …).
 * Prefers the largest structurally valid JPEG (full preview over tiny thumbs).
 */

const MIN_JPEG_BYTES = 2_048;

function isMarker(byte: number): boolean {
  return byte >= 0xc0 && byte !== 0xff;
}

/**
 * Walk a JPEG starting at `start` and return the end index (exclusive), or -1.
 */
function scanJpegEnd(data: Uint8Array, start: number): number {
  if (data[start] !== 0xff || data[start + 1] !== 0xd8 || data[start + 2] !== 0xff) {
    return -1;
  }

  let i = start + 2;
  while (i < data.length - 1) {
    if (data[i] !== 0xff) {
      // Free-running entropy data after SOS — seek EOI
      const eoi = indexOfEoi(data, i);
      return eoi;
    }

    // Skip fill bytes 0xFF
    while (i < data.length && data[i] === 0xff) i++;
    if (i >= data.length) return -1;

    const marker = data[i]!;
    i++;

    // Standalone markers without length
    if (marker === 0xd9) return i; // EOI
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd8) return -1; // nested SOI — invalid for our purposes

    if (i + 1 >= data.length) return -1;
    const len = (data[i]! << 8) | data[i + 1]!;
    if (len < 2) return -1;
    i += len;

    // After SOS (0xDA), remaining bytes are entropy-coded until EOI
    if (marker === 0xda) {
      const eoi = indexOfEoi(data, i);
      return eoi;
    }

    if (!isMarker(marker) && marker !== 0xe0 && marker < 0xe0 && marker !== 0xfe) {
      // Unknown but length-based APP/COM/DHT/etc. already skipped via len
    }
  }

  return -1;
}

function indexOfEoi(data: Uint8Array, from: number): number {
  for (let i = from; i < data.length - 1; i++) {
    if (data[i] === 0xff && data[i + 1] === 0xd9) {
      return i + 2;
    }
    // Skip escaped 0xFF 0x00 in entropy stream — still fine to scan for FFD9
  }
  return -1;
}

export interface EmbeddedJpeg {
  bytes: Uint8Array;
  offset: number;
  size: number;
}

/** Find all reasonably sized embedded JPEGs in a buffer */
export function findEmbeddedJpegs(
  data: Uint8Array,
  options?: { minSize?: number; maxResults?: number },
): EmbeddedJpeg[] {
  const minSize = options?.minSize ?? MIN_JPEG_BYTES;
  const maxResults = options?.maxResults ?? 32;
  const found: EmbeddedJpeg[] = [];

  for (let i = 0; i < data.length - 3; i++) {
    if (data[i] !== 0xff || data[i + 1] !== 0xd8 || data[i + 2] !== 0xff) {
      continue;
    }

    const end = scanJpegEnd(data, i);
    if (end < 0) continue;

    const size = end - i;
    if (size >= minSize) {
      found.push({
        bytes: data.subarray(i, end),
        offset: i,
        size,
      });
      if (found.length >= maxResults) break;
      i = end - 1;
    }
  }

  return found;
}

/** Return the largest embedded JPEG, or undefined */
export function largestEmbeddedJpeg(
  data: Uint8Array,
  options?: { minSize?: number },
): Uint8Array | undefined {
  const all = findEmbeddedJpegs(data, options);
  if (all.length === 0) return undefined;
  let best = all[0]!;
  for (const j of all) {
    if (j.size > best.size) best = j;
  }
  return best.bytes;
}
