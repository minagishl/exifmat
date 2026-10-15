/** Built-in template identifiers */
export type TemplateId =
  | "gallery-white"
  | "gallery-dark"
  | "gallery-white-lens"
  | "gallery-dark-lens"
  | "split-dark"
  | "split-white"
  | "stack-white"
  | "stack-dark"
  | "stack-row-white"
  | "stack-row-dark"
  | "sidebar"
  | "minimal"
  | "card"
  | "crest-white"
  | "crest-dark"
  | "spec-white"
  | "spec-dark"
  | "rail-white"
  | "rail-dark"
  | "overlay"
  | "overlay-center"
  | "overlay-gallery"
  | "overlay-gallery-lens"
  | "overlay-rule"
  | "overlay-glass"
  | "overlay-glass-date";

/** EXIF fields that can be shown on a frame */
export type ExifField =
  | "camera"
  | "lens"
  | "focalLength"
  | "aperture"
  | "shutter"
  | "iso"
  | "time"
  | "date";

/** Normalized EXIF metadata used for rendering */
export interface NormalizedExif {
  make?: string;
  model?: string;
  lens?: string;
  focalLength?: string;
  aperture?: string;
  shutterSpeed?: string;
  iso?: string;
  dateTime?: string;
  /** Raw make string used for logo matching */
  makeRaw?: string;
}

/** Manual EXIF overrides (partial) */
export type ExifOverride = Partial<NormalizedExif>;

export interface FrameStyleOptions {
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  paddingRatio?: number;
  fontFamily?: string;
  borderRadius?: number;
}

/** Horizontal caption layout for supported templates (Gallery, Split, Overlay, Minimal, Sidebar, …) */
export type CaptionDirection = "ltr" | "rtl";

export interface CreateFrameOptions extends FrameStyleOptions {
  /**
   * Swap left/right caption groups on supported templates.
   * - `ltr` (default): brand/logo on the left, settings on the right
   * - `rtl`: brand/logo on the right, settings on the left
   * Centered templates (Stack, Overlay Center) ignore this.
   */
  captionDirection?: CaptionDirection;
  /** Show manufacturer logo when available (default: true) */
  showLogo?: boolean;
  /**
   * Keep the logo’s original brand colors instead of tinting it to the
   * frame text color. Default: false (monochrome tint).
   */
  colorLogo?: boolean;
  /**
   * When a logo is shown, strip the brand name from the camera/model label
   * (e.g. logo + "EOS R7" instead of logo + "Canon EOS R7"). Default: true.
   */
  stripBrandFromModel?: boolean;
  /** Which EXIF fields to display */
  fields?: ExifField[];
  /** Override parsed EXIF values */
  exif?: ExifOverride;
  /**
   * Output quality for lossy encodings (JPEG / WebP), from `0` to `1`.
   * Default: `0.92`. Ignored for PNG. Also used as the default for
   * `FrameResult.toBlob` / `toDataURL` / `toBuffer` when no quality is passed.
   */
  quality?: number;
  /** Max output width in pixels (scales down if larger) */
  maxWidth?: number;
}

export type ImageInput =
  | File
  | Blob
  | ArrayBuffer
  | Uint8Array
  | HTMLImageElement
  | ImageBitmap
  | string;

export interface CreateFrameInput {
  image: ImageInput;
  template?: TemplateId | string;
  options?: CreateFrameOptions;
  /**
   * Original filename (e.g. `IMG_0001.CR3`).
   * Helps detect RAW formats when `image` is a bare buffer.
   * Inferred automatically from `File.name` when possible.
   */
  filename?: string;
}

/** Canvas-like surface shared by browser and Node adapters */
export interface FrameCanvas {
  width: number;
  height: number;
  getContext(type: "2d"): CanvasRenderingContext2D | null;
  toDataURL(type?: string, quality?: number): string;
  toBuffer?(type?: string, quality?: number): Promise<Uint8Array> | Uint8Array;
  convertToBlob?(options?: { type?: string; quality?: number }): Promise<Blob>;
  /**
   * Native drawable for `ctx.drawImage` (HTMLCanvasElement or napi canvas).
   * The FrameCanvas wrapper itself is not a valid CanvasImageSource.
   */
  asImageSource(): CanvasImageSource;
}

export interface FrameResult {
  canvas: FrameCanvas;
  exif: NormalizedExif;
  template: string;
  width: number;
  height: number;
  toDataURL(type?: string, quality?: number): string;
  toBlob(type?: string, quality?: number): Promise<Blob>;
  toBuffer(type?: string, quality?: number): Promise<Uint8Array>;
}

export interface TemplateRenderContext {
  ctx: CanvasRenderingContext2D;
  canvas: FrameCanvas;
  image: CanvasImageSource;
  imageWidth: number;
  imageHeight: number;
  exif: NormalizedExif;
  options: Required<
    Pick<
      CreateFrameOptions,
      | "showLogo"
      | "colorLogo"
      | "stripBrandFromModel"
      | "captionDirection"
      | "fields"
      | "fontFamily"
    >
  > &
    FrameStyleOptions & {
      quality: number;
      logo?: LogoAsset | null;
    };
}

export interface LogoAsset {
  id: string;
  name: string;
  /** SVG markup */
  svg: string;
  /** Preferred draw aspect ratio (width / height) */
  aspect: number;
}

export interface TemplateRenderer {
  id: string;
  name: string;
  description: string;
  render(ctx: TemplateRenderContext): void | Promise<void>;
}
