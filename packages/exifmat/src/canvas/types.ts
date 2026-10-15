import type { FrameCanvas, ImageInput } from "../types";

export interface LoadImageOptions {
  /** Downscale so width does not exceed this (avoids browser canvas size limits) */
  maxWidth?: number;
}

export interface CanvasEnvironment {
  createCanvas(width: number, height: number): FrameCanvas;
  loadImage(
    source: ImageInput,
    options?: LoadImageOptions,
  ): Promise<{
    image: CanvasImageSource;
    width: number;
    height: number;
  }>;
  loadImageFromUrl(url: string): Promise<CanvasImageSource>;
  isNode: boolean;
}

export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

/** Browser canvas area/side limits — stay safely under typical Chromium caps */
export const MAX_CANVAS_SIDE = 8192;
export const MAX_CANVAS_PIXELS = 16_777_216; // 4096²
