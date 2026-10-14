import { describe, expect, test } from "bun:test";
import { findEmbeddedJpegs, largestEmbeddedJpeg } from "./jpeg";
import { isRawExtension, isDecodableRaster, detectRawMagic } from "./formats";

/** Minimal valid 1x1 JPEG */
function tinyJpeg(): Uint8Array {
  // SOI + APP0 (JFIF) + SOF0 1x1 + SOS + padding + EOI — keep simple FFD8..FFD9
  return Uint8Array.from([
    0xff,
    0xd8,
    0xff,
    0xe0,
    0x00,
    0x10,
    0x4a,
    0x46,
    0x49,
    0x46,
    0x00,
    0x01,
    0x01,
    0x00,
    0x00,
    0x01,
    0x00,
    0x01,
    0x00,
    0x00,
    0xff,
    0xdb,
    0x00,
    0x43,
    0x00,
    ...Array(64).fill(1),
    0xff,
    0xc0,
    0x00,
    0x0b,
    0x08,
    0x00,
    0x01,
    0x00,
    0x01,
    0x01,
    0x01,
    0x11,
    0x00,
    0xff,
    0xc4,
    0x00,
    0x14,
    0x00,
    0x01,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x03,
    0xff,
    0xda,
    0x00,
    0x08,
    0x01,
    0x01,
    0x00,
    0x00,
    0x3f,
    0x00,
    0x7f,
    0xff,
    0xd9,
  ]);
}

describe("RAW extensions", () => {
  test("detects CR3 / NEF / ARW filenames", () => {
    expect(isRawExtension("shot.CR3")).toBe(true);
    expect(isRawExtension("a.nef")).toBe(true);
    expect(isRawExtension("b.ARW")).toBe(true);
    expect(isRawExtension("c.dng")).toBe(true);
    expect(isRawExtension("photo.jpg")).toBe(false);
  });
});

describe("magic detection", () => {
  test("JPEG is decodable raster", () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(isDecodableRaster(jpeg)).toBe(true);
  });

  test("CR3 ftyp brand is RAW", () => {
    const buf = new Uint8Array(16);
    buf.set([0x00, 0x00, 0x00, 0x18], 0);
    buf.set(
      Array.from("ftyp").map((c) => c.charCodeAt(0)),
      4,
    );
    buf.set(
      Array.from("crx ").map((c) => c.charCodeAt(0)),
      8,
    );
    expect(detectRawMagic(buf)).toBe(true);
  });
});

describe("embedded JPEG scan", () => {
  test("finds largest JPEG in a padded buffer", () => {
    const small = tinyJpeg();
    // Build a larger fake JPEG by repeating SOS payload before EOI
    const head = small.subarray(0, small.length - 2);
    const large = new Uint8Array(head.length + 6000 + 2);
    large.set(head, 0);
    large.fill(0x3f, head.length, head.length + 6000);
    large[head.length + 6000] = 0xff;
    large[head.length + 6001] = 0xd9;

    const container = new Uint8Array(100 + small.length + 50 + large.length + 20);
    container.fill(0xab);
    container.set(small, 100);
    container.set(large, 100 + small.length + 50);

    const all = findEmbeddedJpegs(container, { minSize: 100 });
    expect(all.length).toBeGreaterThanOrEqual(1);

    const best = largestEmbeddedJpeg(container, { minSize: 100 });
    expect(best).toBeDefined();
    expect(best!.byteLength).toBeGreaterThanOrEqual(large.byteLength - 10);
    expect(best![0]).toBe(0xff);
    expect(best![1]).toBe(0xd8);
  });
});
