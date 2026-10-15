import { describe, expect, test } from "bun:test";
import { resolveLogo, listLogos, loadLogoImage, logos } from "./index";
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

describe("loadLogoImage tint", () => {
  const TINT = "#123456";

  async function tinted(id: string, colorLogo: boolean): Promise<string> {
    const logo = logos.get(id)!;
    let url = "";
    await loadLogoImage(
      logo,
      TINT,
      async (src) => {
        url = src;
        return {} as CanvasImageSource;
      },
      { colorLogo },
    );
    return atob(url.split(",")[1]!);
  }

  test("mono mode leaves no original brand fills, for every logo", async () => {
    for (const logo of listLogos()) {
      const svg = await tinted(logo.id, false);
      const fills = [...svg.matchAll(/\bfill="([^"]*)"/gi)].map((m) => m[1]!.toLowerCase());
      // Only the tint, `none`, gradients, and the knockout mask's own black / white remain
      const stray = fills.filter(
        (f) => f !== TINT && f !== "none" && !f.startsWith("url(") && f !== "#000" && f !== "#fff",
      );
      expect(stray, logo.id).toEqual([]);
    }
  });

  test("mono mode keeps every logo's markup well-formed", async () => {
    for (const logo of listLogos()) {
      const svg = await tinted(logo.id, false);
      expect(svg.trimEnd().endsWith("</svg>"), logo.id).toBe(true);
      // A stylesheet must still close, and no rule may swallow markup
      expect((svg.match(/<style/g) ?? []).length, logo.id).toBe(
        (svg.match(/<\/style>/g) ?? []).length,
      );
      expect(svg, logo.id).not.toMatch(/fill\s*:[^;"}<]*[<>]/);
    }
  });

  test("white lettering is cut out of a flat shape instead of filling it", async () => {
    const svg = await tinted("leica", false);
    expect(svg).toContain("<mask");
    expect(svg).toContain('mask="url(#exifmat-knockout)"');
  });

  test("color mode keeps the brand fills", async () => {
    const svg = await tinted("leica", true);
    expect(svg).toContain("#ed1c24");
    expect(svg).not.toContain("<mask");
  });
});
