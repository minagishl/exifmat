import type { FrameCanvas, ImageInput } from "../types";
import type { CanvasEnvironment } from "./types";
import { ensureInterFontRegistered } from "./fonts";

type NapiCanvasModule = {
  createCanvas: (
    width: number,
    height: number,
  ) => {
    width: number;
    height: number;
    getContext: (type: "2d") => CanvasRenderingContext2D;
    toBuffer: (mime?: string, config?: { quality?: number }) => Buffer;
    toDataURL: (mime?: string, quality?: number) => string;
  };
  loadImage: (src: string | Buffer | URL) => Promise<
    {
      width: number;
      height: number;
    } & CanvasImageSource
  >;
};

let cached: NapiCanvasModule | null | undefined;

async function loadNapiCanvas(): Promise<NapiCanvasModule> {
  if (cached) return cached;
  try {
    // Dynamic import keeps browser bundles free of the native module
    const mod = (await import("@napi-rs/canvas")) as unknown as NapiCanvasModule;
    cached = mod;
    return mod;
  } catch {
    cached = null;
    throw new Error(
      "Server-side rendering requires @napi-rs/canvas. Install it with: bun add @napi-rs/canvas",
    );
  }
}

function wrapNapiCanvas(canvas: ReturnType<NapiCanvasModule["createCanvas"]>): FrameCanvas {
  return {
    get width() {
      return canvas.width;
    },
    set width(v: number) {
      canvas.width = v;
    },
    get height() {
      return canvas.height;
    },
    set height(v: number) {
      canvas.height = v;
    },
    getContext(type: "2d") {
      return canvas.getContext(type);
    },
    toDataURL(type?: string, quality?: number) {
      return canvas.toDataURL(type, quality);
    },
    asImageSource() {
      return canvas as unknown as CanvasImageSource;
    },
    toBuffer(type?: string, quality?: number) {
      const mime = type ?? "image/png";
      const buf = canvas.toBuffer(mime, quality != null ? { quality } : undefined);
      return new Uint8Array(buf);
    },
  };
}

async function toBuffer(input: ImageInput): Promise<Buffer> {
  if (typeof input === "string") {
    if (input.startsWith("data:") || input.startsWith("http")) {
      const res = await fetch(input);
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    }
    const { readFile } = await import("node:fs/promises");
    return readFile(input);
  }
  if (input instanceof ArrayBuffer) return Buffer.from(input);
  if (input instanceof Uint8Array) return Buffer.from(input);
  if (typeof Blob !== "undefined" && input instanceof Blob) {
    const ab = await input.arrayBuffer();
    return Buffer.from(ab);
  }
  throw new Error("Unsupported image input in Node/Bun environment");
}

export async function createNodeEnvironment(): Promise<CanvasEnvironment> {
  const napi = await loadNapiCanvas();
  await ensureInterFontRegistered();

  return {
    isNode: true,
    createCanvas(width: number, height: number) {
      return wrapNapiCanvas(napi.createCanvas(width, height));
    },
    async loadImage(source: ImageInput, options?: { maxWidth?: number }) {
      let img: { width: number; height: number } & CanvasImageSource;
      if (typeof source === "string" && (source.startsWith("data:") || source.startsWith("http"))) {
        img = await napi.loadImage(source);
      } else {
        const buf = await toBuffer(source);
        img = await napi.loadImage(buf);
      }

      const maxWidth = options?.maxWidth;
      if (!maxWidth || img.width <= maxWidth) {
        return { image: img, width: img.width, height: img.height };
      }

      const width = maxWidth;
      const height = Math.max(1, Math.round((img.height * maxWidth) / img.width));
      const tmp = wrapNapiCanvas(napi.createCanvas(width, height));
      const ctx = tmp.getContext("2d");
      if (!ctx) throw new Error("Failed to create scaling context");
      ctx.drawImage(img, 0, 0, width, height);
      return { image: tmp.asImageSource(), width, height };
    },
    async loadImageFromUrl(url: string) {
      return napi.loadImage(url);
    },
  };
}
