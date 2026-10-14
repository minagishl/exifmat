# EXIF Frame

Lightweight EXIF photo frame library for the browser, Node.js, and Bun — plus a Vite + React demo that renders frames entirely on-device.

## Packages

| Path                                           | Description                      |
| ---------------------------------------------- | -------------------------------- |
| [`packages/exif-frame`](./packages/exif-frame) | Publishable `exif-frame` library |
| [`apps/web`](./apps/web)                       | Demo site (Tailwind CSS)         |

## Requirements

- [Bun](https://bun.sh) 1.1+

## Develop

```bash
bun install
bun run dev          # demo site at http://localhost:5173
bun run build:lib    # build the library
bun run build        # library + web
bun run typecheck
bun run test
```

## Library usage

```ts
import { createFrame } from "exif-frame";

const framed = await createFrame({
  image: photoFile, // JPEG / PNG / WebP / RAW (CR3, NEF, ARW, DNG, …)
  template: "overlay",
  options: { showLogo: true, quality: 0.92 },
});

await framed.toBlob("image/jpeg"); // uses options.quality by default
```

RAW files use the embedded JPEG preview for rendering (no full demosaic). EXIF still comes from the RAW container.

Manufacturer logos are SVG files under `packages/exif-frame/src/logos/files/` (imported as text and inlined at build time).

Server-side rendering needs the optional peer `@napi-rs/canvas`:

```bash
bun add exif-frame @napi-rs/canvas
```

See [`packages/exif-frame/README.md`](./packages/exif-frame/README.md) for templates, logos, and the full API.

## Built-in templates

`gallery-white` · `gallery-dark` · `gallery-white-lens` · `gallery-dark-lens` · `split-dark` · `split-white` · `stack-white` · `stack-dark` · `stack-row-white` · `stack-row-dark` · `sidebar` · `minimal` · `card` · `crest-white` · `crest-dark` · `overlay` · `overlay-center` · `overlay-gallery` · `overlay-gallery-lens` · `overlay-rule` · `overlay-glass` · `overlay-glass-date`

## Publishing (GitHub Actions + npm OIDC)

Pushing a version tag publishes `exif-frame` to npm via **Trusted Publishing** (OIDC), then creates a GitHub Release on success.

### One-time npm setup

1. Create the package on [npmjs.com](https://www.npmjs.com/) (or publish once manually if required by npm).
2. Open the package → **Settings** → **Trusted Publisher**.
3. Add GitHub Actions:
   - **Organization / user:** `minagishl`
   - **Repository:** `exif-frame`
   - **Workflow filename:** `publish.yml`
4. Save.

No long-lived `NPM_TOKEN` secret is required when Trusted Publishing is configured.

### Release flow

1. Bump `version` in [`packages/exif-frame/package.json`](./packages/exif-frame/package.json).
2. Commit the change.
3. Tag and push:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The tag (without `v`) **must** match the package version. Workflow: [`.github/workflows/publish.yml`](./.github/workflows/publish.yml).

## License

MIT
