import { describe, expect, test } from "bun:test";
import { parseExif, formatCamera, formatSettingsLine } from "./exif";

describe("parseExif", () => {
  test("reads named tags from a real JPEG with EXIF", async () => {
    const url = "https://raw.githubusercontent.com/ianare/exif-samples/master/jpg/Canon_40D.jpg";
    const res = await fetch(url);
    const buf = new Uint8Array(await res.arrayBuffer());

    const exif = await parseExif(buf);
    expect(exif.make).toBe("Canon");
    expect(exif.model).toContain("40D");
    expect(exif.aperture).toMatch(/^f\//);
    expect(exif.shutterSpeed).toMatch(/s$/);
    expect(exif.iso).toMatch(/^ISO /);
    expect(exif.focalLength).toMatch(/mm$/);
    expect(formatCamera(exif).length).toBeGreaterThan(0);
    expect(
      formatSettingsLine(exif, ["focalLength", "aperture", "shutter", "iso"]).length,
    ).toBeGreaterThan(0);
  });

  test("override does not wipe with undefined keys", async () => {
    const url = "https://raw.githubusercontent.com/ianare/exif-samples/master/jpg/Canon_40D.jpg";
    const res = await fetch(url);
    const buf = new Uint8Array(await res.arrayBuffer());

    const exif = await parseExif(buf, {
      make: undefined,
      model: undefined,
      lens: "Custom Lens",
    });
    expect(exif.make).toBe("Canon");
    expect(exif.lens).toBe("Custom Lens");
  });
});
