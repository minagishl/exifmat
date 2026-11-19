import { $ } from "bun";
import { existsSync } from "node:fs";
import { mkdir, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

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

/**
 * tsc keeps extensionless relative specifiers from the sources, which breaks
 * `moduleResolution: node16 | nodenext` consumers. Rewrite them to explicit
 * `.js` / `/index.js` paths so the declarations resolve under every mode.
 */
async function addDeclarationExtensions(dir: string): Promise<void> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await addDeclarationExtensions(path);
      continue;
    }
    if (!entry.name.endsWith(".d.ts")) continue;

    const source = await Bun.file(path).text();
    const rewritten = source.replace(
      /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)(["'])(\.{1,2}(?:\/[^"']*)?)\2/g,
      (match, prefix: string, quote: string, spec: string) => {
        if (/\.[cm]?[jt]s$/.test(spec)) return match;
        const base = join(dirname(path), spec);
        if (existsSync(`${base}.d.ts`)) return `${prefix}${quote}${spec}.js${quote}`;
        if (existsSync(join(base, "index.d.ts"))) {
          return `${prefix}${quote}${spec.replace(/\/$/, "")}/index.js${quote}`;
        }
        return match;
      },
    );
    if (rewritten !== source) await Bun.write(path, rewritten);
  }
}

await addDeclarationExtensions(dist);

await Bun.write(
  join(dist, "canvas/node.stub.js"),
  `export async function createNodeEnvironment() {\n  throw new Error('Node canvas adapter is not available in the browser');\n}\n`,
);

console.log("Built exifmat → dist/");
