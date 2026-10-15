/**
 * Minify all SVGs in src/logos/files/ with SVGO (in place).
 *
 * Usage:
 *   bun run scripts/minify-logos.js
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { optimize } from "svgo";

const __dirname = dirname(fileURLToPath(import.meta.url));
const logosDir = join(__dirname, "../src/logos/files");

const svgoConfig = {
  multipass: true,
  plugins: [
    {
      name: "preset-default",
      params: {
        overrides: {
          cleanupIds: {
            minify: true,
            remove: false,
          },
        },
      },
    },
    "removeDimensions",
  ],
};

const files = (await readdir(logosDir)).filter((f) => f.endsWith(".svg")).sort();

if (files.length === 0) {
  console.error("No SVG files found in", logosDir);
  process.exit(1);
}

let saved = 0;
let beforeTotal = 0;
let afterTotal = 0;

for (const file of files) {
  const path = join(logosDir, file);
  const input = await readFile(path, "utf8");
  const before = Buffer.byteLength(input, "utf8");
  const result = optimize(input, { path, ...svgoConfig });
  if (result.error) {
    console.error(`FAIL ${file}: ${result.error}`);
    process.exitCode = 1;
    continue;
  }
  const output = result.data;
  const after = Buffer.byteLength(output, "utf8");
  await writeFile(path, output);
  beforeTotal += before;
  afterTotal += after;
  saved += before - after;
  const pct = before === 0 ? 0 : Math.round((1 - after / before) * 100);
  console.log(`${file}: ${before} → ${after} B (−${pct}%)`);
}

console.log(`\nDone: ${files.length} files, ${beforeTotal} → ${afterTotal} B (−${saved} B)`);
