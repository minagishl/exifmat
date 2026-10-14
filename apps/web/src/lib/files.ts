import { isRawExtension, RAW_EXTENSIONS } from "exif-frame";

const RASTER_MIME =
  /^(image\/(jpeg|png|webp|gif|bmp|heic|heif|tiff|x-adobe-dng|x-canon-cr2|x-canon-cr3|x-nikon-nef|x-sony-arw).*)$/i;

export const ACCEPT_ATTR = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/tiff",
  ...RAW_EXTENSIONS.map((ext) => `.${ext}`),
].join(",");

export function isAcceptedPhoto(file: File): boolean {
  if (RASTER_MIME.test(file.type)) return true;
  if (file.type.startsWith("image/")) return true;
  if (isRawExtension(file.name)) return true;
  // Browsers often leave RAW MIME empty
  if (!file.type && isRawExtension(file.name)) return true;
  return false;
}
