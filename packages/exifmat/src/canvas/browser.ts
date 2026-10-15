import type { FrameCanvas, ImageInput } from "../types";
import type { CanvasEnvironment, LoadImageOptions } from "./types";
import { MAX_CANVAS_PIXELS, MAX_CANVAS_SIDE } from "./types";

function mimeFromBytes(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return "image/gif";
  if (bytes[0] === 0x52 && bytes[1] === 0x49) return "image/webp";
  return "application/octet-stream";
}

function wrapHtmlCanvas(el: HTMLCanvasElement): FrameCanvas {
  return {
    get width() {
      return el.width;
    },
    set width(v: number) {
      el.width = v;
    },
    get height() {
      return el.height;
    },
    set height(v: number) {
      el.height = v;
    },
    getContext(type: "2d") {
      return el.getContext(type);
    },
    toDataURL(type?: string, quality?: number) {
      return el.toDataURL(type, quality);
    },
    asImageSource() {
      return el;
    },
    async convertToBlob(options?: { type?: string; quality?: number }) {
      return new Promise<Blob>((resolve, reject) => {
        el.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Failed to convert canvas to Blob"));
          },
          options?.type ?? "image/png",
          options?.quality,
        );
      });
    },
    async toBuffer(type?: string, quality?: number) {
      const blob = await this.convertToBlob!({ type, quality });
      const buf = await blob.arrayBuffer();
      return new Uint8Array(buf);
    },
  };
}

async function blobFromInput(input: ImageInput): Promise<Blob> {
  if (typeof input === "string") {
    const res = await fetch(input);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    return res.blob();
  }
  if (input instanceof Blob) {
    if (input.type && input.type !== "application/octet-stream") return input;
    const buf = new Uint8Array(await input.arrayBuffer());
    return new Blob([buf], { type: mimeFromBytes(buf) });
  }
  if (input instanceof ArrayBuffer) {
    const bytes = new Uint8Array(input);
    return new Blob([bytes], { type: mimeFromBytes(bytes) });
  }
  if (input instanceof Uint8Array) {
    const copy = new Uint8Array(input.byteLength);
    copy.set(input);
    return new Blob([copy], { type: mimeFromBytes(copy) });
  }
  throw new Error("Unsupported image input in browser");
}

function targetSize(
  width: number,
  height: number,
  maxWidth?: number,
): { width: number; height: number } {
  let w = width;
  let h = height;

  if (maxWidth && w > maxWidth) {
    const scale = maxWidth / w;
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
  }

  // Stay under browser canvas limits
  const sideScale = Math.min(1, MAX_CANVAS_SIDE / w, MAX_CANVAS_SIDE / h);
  const areaScale = Math.min(1, Math.sqrt(MAX_CANVAS_PIXELS / (w * h)));
  const scale = Math.min(sideScale, areaScale);
  if (scale < 1) {
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
  }
  return { width: w, height: h };
}

function bakeDrawable(
  source: CanvasImageSource,
  width: number,
  height: number,
): { image: HTMLCanvasElement; width: number; height: number } {
  if (width < 1 || height < 1) {
    throw new Error("Decoded image has zero dimensions");
  }
  const el = document.createElement("canvas");
  el.width = width;
  el.height = height;
  const ctx = el.getContext("2d");
  if (!ctx) throw new Error("Failed to acquire 2D canvas context");
  ctx.drawImage(source, 0, 0, width, height);
  return { image: el, width, height };
}

/**
 * Decode any input into a stable, size-capped HTMLCanvasElement.
 * Baking immediately avoids ImageBitmap lifetime issues and revoked object URLs.
 */
async function decodeToCanvas(
  input: ImageInput,
  options?: LoadImageOptions,
): Promise<{ image: HTMLCanvasElement; width: number; height: number }> {
  if (typeof HTMLImageElement !== "undefined" && input instanceof HTMLImageElement) {
    if (!input.complete || input.naturalWidth === 0) {
      await new Promise<void>((resolve, reject) => {
        input.onload = () => resolve();
        input.onerror = () => reject(new Error("Image failed to load"));
      });
    }
    const size = targetSize(
      input.naturalWidth || input.width,
      input.naturalHeight || input.height,
      options?.maxWidth,
    );
    return bakeDrawable(input, size.width, size.height);
  }

  if (typeof ImageBitmap !== "undefined" && input instanceof ImageBitmap) {
    const size = targetSize(input.width, input.height, options?.maxWidth);
    const baked = bakeDrawable(input, size.width, size.height);
    input.close();
    return baked;
  }

  const blob = await blobFromInput(input);

  // Prefer createImageBitmap with resize — avoids allocating a full-res canvas
  if (typeof createImageBitmap === "function") {
    try {
      const full = await createImageBitmap(blob);
      try {
        const size = targetSize(full.width, full.height, options?.maxWidth);
        if (size.width !== full.width || size.height !== full.height) {
          const resized = await createImageBitmap(full, {
            resizeWidth: size.width,
            resizeHeight: size.height,
            resizeQuality: "high",
          });
          try {
            return bakeDrawable(resized, resized.width, resized.height);
          } finally {
            resized.close();
          }
        }
        return bakeDrawable(full, full.width, full.height);
      } finally {
        full.close();
      }
    } catch {
      // fall through to HTMLImageElement
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Image failed to load"));
      img.src = url;
    });
    await img.decode().catch(() => undefined);

    const size = targetSize(
      img.naturalWidth || img.width,
      img.naturalHeight || img.height,
      options?.maxWidth,
    );
    if (size.width < 1 || size.height < 1) {
      throw new Error("Decoded image has zero dimensions");
    }
    // Bake while object URL is still valid
    return bakeDrawable(img, size.width, size.height);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function createBrowserEnvironment(): CanvasEnvironment {
  return {
    isNode: false,
    createCanvas(width: number, height: number) {
      const el = document.createElement("canvas");
      el.width = Math.max(1, Math.round(width));
      el.height = Math.max(1, Math.round(height));
      return wrapHtmlCanvas(el);
    },
    loadImage: decodeToCanvas,
    async loadImageFromUrl(url: string) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load image URL`));
        img.src = url;
      });
      return img;
    },
  };
}
