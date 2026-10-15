# exif-frame

Lightweight EXIF photo frame generator for **browser**, **Node.js**, and **Bun**.

Draws photography frames with camera metadata on a Canvas 2D surface — no DOM layout, no SVG scene graph.

## Install

```bash
bun add exif-frame
# or: npm install exif-frame
```

For server-side rendering, also install the optional canvas backend:

```bash
bun add @napi-rs/canvas
```

Default typeface is **Inter Variable**. In the browser, load it yourself (e.g. `@fontsource-variable/inter`). On Node/Bun, `InterVariable.ttf` is registered automatically via `@napi-rs/canvas` `GlobalFonts` when the canvas environment starts.

## RAW support

Camera RAW files are supported without a full demosaic pipeline (keeps the library light and fast):

- **Formats:** CR3, CR2, NEF, ARW, DNG, ORF, RW2, RAF, PEF, SRW, and other common RAW containers
- **Image:** largest embedded JPEG preview is extracted and framed
- **Metadata:** EXIF is read from the original RAW (with a fallback to the preview JPEG tags)

```ts
await createFrame({
  image: cr3Buffer,
  filename: "IMG_0001.CR3", // helpful when passing a bare buffer
  template: "gallery-white",
});
```

## Quick start

```ts
import { createFrame, parseExif } from "exif-frame";

const result = await createFrame({
  image: fileOrBuffer,
  template: "gallery-white",
  options: {
    showLogo: true,
    // Keep original brand colors (default: false = tint to text color)
    colorLogo: false,
    // When a logo is shown, hide the brand in the model label (default: true)
    // e.g. logo + "EOS R7" instead of logo + "Canon EOS R7"
    stripBrandFromModel: true,
    fields: ["camera", "lens", "focalLength", "aperture", "shutter", "iso"],
    // JPEG / WebP quality (0–1, default 0.92). Used by toBlob / toDataURL / toBuffer
    // when you omit the quality argument. Ignored for PNG.
    quality: 0.92,
    // Swap left/right caption groups on Gallery, Split, Minimal, Overlay, Sidebar
    // (default: 'ltr'). Centered templates (Stack, Overlay Center) ignore this.
    // captionDirection: 'rtl',
    // Optional: cap output width (scales down while preserving aspect ratio)
    // maxWidth: 1600,
  },
});

// Browser — quality defaults to options.quality
const blob = await result.toBlob("image/jpeg");

// Node / Bun
const buffer = await result.toBuffer("image/png");
```

## Templates

| ID                     | Description                                                             |
| ---------------------- | ----------------------------------------------------------------------- |
| `gallery-white`        | Full-bleed photo with white status bar (logo \| model · settings)       |
| `gallery-dark`         | Full-bleed photo with black status bar (logo \| model · settings)       |
| `gallery-white-lens`   | Gallery White with lens under logo/model                                |
| `gallery-dark-lens`    | Gallery Dark with lens under logo/model                                 |
| `split-dark`           | Minimal-size mat: model/lens · logo \| settings/date (dark)             |
| `split-white`          | Minimal-size mat: model/lens · logo \| settings/date (light)            |
| `stack-white`          | Centered Overlay-style stack (logo → name → details) on a white bar     |
| `stack-dark`           | Centered Overlay-style stack (logo → name → details) on a black bar     |
| `stack-row-white`      | Logo + name on one row, details below (white bar)                       |
| `stack-row-dark`       | Logo + name on one row, details below (black bar)                       |
| `sidebar`              | White mat; right caption (logo → name → lens → settings)                |
| `minimal`              | Museum mat with brand / exposure caption                                |
| `card`                 | Rounded photo on a paper mat; centered camera + exposure caption        |
| `crest-white`          | Logo above photo; camera + exposure below (light mat)                   |
| `crest-dark`           | Logo above photo; camera + exposure below (dark mat)                    |
| `spec-white`           | Brand header over a labelled focal / aperture / shutter / ISO grid      |
| `spec-dark`            | Same grid on a dark mat                                                 |
| `rail-white`           | Caption set vertically in a slim column beside the photo                |
| `rail-dark`            | Same column on a dark mat                                               |
| `overlay`              | Full-bleed stacked caption on a soft gradient                           |
| `overlay-center`       | Full-bleed centered stack (logo → name → details) on a soft gradient    |
| `overlay-gallery`      | Overlay caption in Gallery layout                                       |
| `overlay-gallery-lens` | Overlay caption in Gallery with lens layout                             |
| `overlay-rule`         | Gallery lens caption with a bottom hairline rule                        |
| `overlay-glass`        | Edge-color wash + blur glass strip; Gallery Lens caption; adaptive text |
| `overlay-glass-date`   | Top glass time/date; bottom glass Gallery Lens caption; adaptive text   |

Register your own:

```ts
import { registerTemplate } from "exif-frame";

registerTemplate({
  id: "my-frame",
  name: "My Frame",
  description: "Custom layout",
  async render(ctx) {
    // draw with ctx.ctx / ctx.image / ctx.exif
  },
});
```

## Manufacturer logos

When `showLogo` is enabled, EXIF `Make` is matched to a bundled wordmark (Canon, Nikon, Sony, Fujifilm, Leica, Olympus / OM System, Panasonic, Apple, Google, Ricoh, Hasselblad, DJI).

To pin a specific logo instead of matching it from EXIF (for example when the make is missing or unrecognized), pass `logoId` with an `id` from `listLogos()`:

```ts
import { createFrame, listLogos } from "exif-frame";

console.log(listLogos().map((l) => l.id)); // ["alpa", "apple", ..., "sony", ...]

await createFrame({ image, options: { showLogo: true, logoId: "sony" } });
```

Unknown ids fall back to EXIF matching.

By default logos are tinted to the frame text color. Set `colorLogo: true` to keep each brand’s original colors (e.g. Canon red).

With a logo visible, `stripBrandFromModel` (default `true`) removes the brand from the camera line so you get logo + `EOS R7` rather than logo + `Canon EOS R7`. Set it to `false` to keep the full model string.

## License

MIT
