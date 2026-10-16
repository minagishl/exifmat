import { heifBrand, registerImageDecoder } from "exifmat";

/**
 * Browsers other than Safari cannot decode HEIC/HEIF, so convert it to JPEG
 * with libheif (loaded on demand — the wasm is large). EXIF is still read from
 * the original file by exifmat.
 */
registerImageDecoder(async (bytes) => {
  if (heifBrand(bytes) !== "heic") return null;
  const { heicTo } = await import("heic-to");
  const blob = await heicTo({
    blob: new Blob([bytes as Uint8Array<ArrayBuffer>]),
    type: "image/jpeg",
    quality: 0.95,
  });
  return new Uint8Array(await blob.arrayBuffer());
});
