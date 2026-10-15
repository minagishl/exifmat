import { describe, expect, test } from "bun:test";
import { resolveLogo, listLogos, logos } from "./index";
import { formatCamera, formatSettingsLine, stripBrandFromModel } from "../exif";
import type { NormalizedExif } from "../types";

describe("resolveLogo", () => {
  test("matches Nikon Corporation", () => {
    const logo = resolveLogo({ make: "NIKON CORPORATION", model: "NIKON Z 8" });
    expect(logo?.id).toBe("nikon");
  });

  test("matches Fujifilm", () => {
    const logo = resolveLogo({ make: "FUJIFILM", model: "X-T5" });
    expect(logo?.id).toBe("fujifilm");
  });

  test("matches OM System", () => {
    const logo = resolveLogo({ make: "OM Digital Solutions", model: "OM-1" });
    expect(logo?.id).toBe("om-system");
  });

  test("returns null for unknown make", () => {
    expect(resolveLogo({ make: "UnknownCam" })).toBeNull();
  });

  test("lists bundled logos", () => {
    expect(listLogos().length).toBeGreaterThanOrEqual(12);
  });
});

describe("format helpers", () => {
  const exif: NormalizedExif = {
    make: "Canon",
    model: "EOS R5",
    focalLength: "50mm",
    aperture: "f/1.2",
    shutterSpeed: "1/500s",
    iso: "ISO 800",
  };

  test("formatCamera avoids duplicating make", () => {
    expect(formatCamera({ make: "Canon", model: "Canon EOS R5" })).toBe("Canon EOS R5");
  });

  test("stripBrandFromModel removes leading brand", () => {
    expect(stripBrandFromModel("Canon EOS R7", "Canon")).toBe("EOS R7");
    expect(stripBrandFromModel("NIKON Z 8", "NIKON CORPORATION")).toBe("Z 8");
    expect(stripBrandFromModel("X-T5", "FUJIFILM")).toBe("X-T5");
    expect(
      formatCamera(
        { make: "Canon", model: "Canon EOS R7" },
        { stripBrand: true, brandNames: ["Canon"] },
      ),
    ).toBe("EOS R7");
  });

  test("formatSettingsLine joins fields", () => {
    expect(formatSettingsLine(exif, ["focalLength", "aperture", "shutter", "iso"])).toBe(
      "50mm · f/1.2 · 1/500s · ISO 800",
    );
  });

  test("formatSettingsLine keeps canonical order", () => {
    expect(formatSettingsLine(exif, ["iso", "shutter", "focalLength", "aperture"])).toBe(
      "50mm · f/1.2 · 1/500s · ISO 800",
    );
  });
});

describe("logos.get", () => {
  test("returns a bundled logo by id", () => {
    expect(logos.get("sony")?.name).toBe("Sony");
  });

  test("returns null for an unknown id", () => {
    expect(logos.get("nope")).toBeNull();
  });
});
