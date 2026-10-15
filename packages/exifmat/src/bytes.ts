import type { ImageInput } from "./types";

/** Convert supported image inputs to a Uint8Array for parsing / RAW preview */
export async function toUint8Array(input: ImageInput): Promise<Uint8Array> {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);

  if (typeof input === "string") {
    if (input.startsWith("data:")) {
      const base64 = input.split(",")[1] ?? "";
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }
    if (input.startsWith("http://") || input.startsWith("https://") || input.startsWith("blob:")) {
      const res = await fetch(input);
      if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    }
    // File path (Node / Bun) — hide from browser bundler static analysis
    const dynImport = new Function("s", "return import(s)") as (
      s: string,
    ) => Promise<typeof import("node:fs/promises")>;
    const { readFile } = await dynImport("node:fs/promises");
    return new Uint8Array(await readFile(input));
  }

  if (typeof Blob !== "undefined" && input instanceof Blob) {
    return new Uint8Array(await input.arrayBuffer());
  }

  if (typeof HTMLImageElement !== "undefined" && input instanceof HTMLImageElement) {
    if (input.src) return toUint8Array(input.src);
    throw new Error("HTMLImageElement has no src to read bytes from");
  }

  if (typeof ImageBitmap !== "undefined" && input instanceof ImageBitmap) {
    throw new Error(
      "Cannot read bytes from ImageBitmap. Pass the original File, Blob, or ArrayBuffer instead.",
    );
  }

  throw new Error("Unsupported image input");
}

export function filenameFromInput(input: ImageInput, explicit?: string | null): string | undefined {
  if (explicit) return explicit;
  if (typeof File !== "undefined" && input instanceof File) return input.name;
  if (typeof input === "string" && !input.startsWith("data:") && !input.startsWith("blob:")) {
    const parts = input.split(/[/\\]/);
    return parts[parts.length - 1];
  }
  return undefined;
}
