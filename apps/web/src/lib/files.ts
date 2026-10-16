import { isRawExtension, RAW_EXTENSIONS } from "exifmat";

const RASTER_MIME =
  /^(image\/(jpeg|png|webp|gif|bmp|heic|heif|tiff|x-adobe-dng|x-canon-cr2|x-canon-cr3|x-nikon-nef|x-sony-arw).*)$/i;

/** Raster extensions browsers often leave without a MIME type */
const EXTRA_EXTENSIONS = ["heic", "heif", "hif", "avif", "jfif", "jpe", "tif", "tiff"];
const EXTRA_EXT_RE = new RegExp(`\\.(${EXTRA_EXTENSIONS.join("|")})$`, "i");

export const ACCEPT_ATTR = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
  "image/gif",
  "image/bmp",
  "image/tiff",
  ...EXTRA_EXTENSIONS.map((ext) => `.${ext}`),
  ...RAW_EXTENSIONS.map((ext) => `.${ext}`),
].join(",");

export function isAcceptedPhoto(file: File): boolean {
  if (RASTER_MIME.test(file.type)) return true;
  if (file.type.startsWith("image/")) return true;
  if (isRawExtension(file.name) || EXTRA_EXT_RE.test(file.name)) return true;
  return false;
}
