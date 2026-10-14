import { $ } from "bun";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const dist = join(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, "canvas"), { recursive: true });

/**
 * Bundle the public entry so SVG `with { type: 'text' }` imports are inlined.
 * Keep the Node canvas adapter as a separate file (optional @napi-rs/canvas).
 */
const main = await Bun.build({
  entrypoints: [join(root, "src/index.ts")],
  outdir: dist,
  target: "node",
  format: "esm",
  sourcemap: "external",
  external: ["@napi-rs/canvas", "exifr"],
  plugins: [
    {
      name: "externalize-node-canvas",
      setup(build) {
        build.onResolve({ filter: /canvas\/node(?:\.(?:ts|js))?$/ }, () => ({
          path: "./canvas/node.js",
          external: true,
        }));
      },
    },
  ],
});

if (!main.success) {
  for (const log of main.logs) console.error(log);
  process.exit(1);
}

const node = await Bun.build({
  entrypoints: [join(root, "src/canvas/node.ts")],
  outdir: join(dist, "canvas"),
  target: "node",
  format: "esm",
  sourcemap: "external",
  external: ["@napi-rs/canvas"],
  naming: "node.js",
});

if (!node.success) {
  for (const log of node.logs) console.error(log);
  process.exit(1);
}

await $`tsc -p ${join(root, "tsconfig.json")} --emitDeclarationOnly`;

await Bun.write(
  join(dist, "canvas/node.stub.js"),
  `export async function createNodeEnvironment() {\n  throw new Error('Node canvas adapter is not available in the browser');\n}\n`,
);

console.log("Built exif-frame → dist/");
