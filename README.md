# EXIF Frame

Generate photo frames that show camera EXIF metadata — camera, lens, focal length, aperture, shutter speed, and ISO. The library runs in the **browser**, **Node.js**, and **Bun** using Canvas 2D (no DOM layout). This repository also includes a Vite + React demo; in the browser, framing happens entirely on your device.

## Features

- **Layout templates** — gallery status bars, mats, stacked captions, glass overlays, and more ([full list](./packages/exif-frame/README.md#templates))
- **Brand logos** — optional manufacturer wordmarks matched from EXIF `Make`
- **RAW support** — frames embedded JPEG previews from common RAW containers (CR3, NEF, ARW, DNG, …) while reading EXIF from the original file
- **Custom templates** — register your own renderers via the public API
- **Server or client** — browser bundle with an optional Node/Bun canvas backend (`@napi-rs/canvas`)

## Try the demo

From the repo root:

```bash
bun install
bun run dev
```

Open [http://localhost:5173](http://localhost:5173), drop a photo, choose a template, and download the result. Nothing is uploaded to a server.

## Install

```bash
npm install exif-frame
# or: bun add exif-frame
```

For server-side rendering, add the optional peer:

```bash
npm install @napi-rs/canvas
```

## Quick start

```ts
import { createFrame } from "exif-frame";

const framed = await createFrame({
  image: photoFile, // JPEG, PNG, WebP, or RAW preview source
  template: "overlay",
  options: { showLogo: true, quality: 0.92 },
});

await framed.toBlob("image/jpeg");
```

See [`packages/exif-frame/README.md`](./packages/exif-frame/README.md) for every template, logo behavior, field options, and export helpers.

## Repository layout

| Path                                           | Description                      |
| ---------------------------------------------- | -------------------------------- |
| [`packages/exif-frame`](./packages/exif-frame) | Publishable `exif-frame` library |
| [`apps/web`](./apps/web)                       | Demo app (Vite, React, Tailwind) |

## Develop

**Requirements:** [Bun](https://bun.sh) 1.1+

```bash
bun install
bun run dev          # demo at http://localhost:5173
bun run build:lib    # build the library
bun run build        # library + web
bun run typecheck
bun run test
bun run lint
bun run fmt:check
```

## Releasing (maintainers)

Pushing a version tag publishes `exif-frame` to npm via GitHub Actions **Trusted Publishing** (OIDC), then creates a GitHub Release when the publish succeeds.

1. Bump `version` in [`packages/exif-frame/package.json`](./packages/exif-frame/package.json) and commit.
2. Tag and push (the tag without the `v` prefix must match the package version):

```bash
git tag v0.1.0
git push origin v0.1.0
```

Workflow: [`.github/workflows/publish.yml`](./.github/workflows/publish.yml). Configure npm Trusted Publishing once for this repository (`minagishl/exif-frame`, workflow file `publish.yml`); no long-lived `NPM_TOKEN` is required.

## License

MIT — see [LICENSE](./LICENSE).
