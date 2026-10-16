/**
 * Pluggable decoders for formats the platform canvas cannot read natively
 * (HEIC/HEIF in most browsers, plain TIFF, …).
 *
 * A decoder turns the original bytes into a canvas-decodable image (JPEG/PNG/WebP).
 * EXIF is still read from the original file, so metadata is kept.
 */
export type ImageDecoder = (
  bytes: Uint8Array,
  filename?: string | null,
) => Promise<Uint8Array | null> | Uint8Array | null;

const decoders: ImageDecoder[] = [];

/** Register a decoder. Returns a function that removes it again. */
export function registerImageDecoder(decoder: ImageDecoder): () => void {
  decoders.push(decoder);
  return () => {
    const i = decoders.indexOf(decoder);
    if (i >= 0) decoders.splice(i, 1);
  };
}

/** Run decoders in registration order; the first non-null result wins. */
export async function decodeWithRegistered(
  bytes: Uint8Array,
  filename?: string | null,
): Promise<Uint8Array | null> {
  for (const decoder of decoders) {
    const out = await decoder(bytes, filename);
    if (out) return out;
  }
  return null;
}
