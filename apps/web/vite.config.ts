import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Bun's `import x from './file.svg' with { type: 'text' }` is not understood by
 * Vite (it emits an asset URL). Force logo SVGs to load as raw strings so
 * canvas data-URLs work in the demo.
 */
function logoSvgAsText(): Plugin {
  return {
    name: "exif-frame-logo-svg-text",
    enforce: "pre",
    async load(id) {
      const file = id.split("?")[0] ?? id;
      if (!file.endsWith(".svg")) return null;
      if (!file.includes("/logos/files/")) return null;
      const source = await readFile(file, "utf8");
      return `export default ${JSON.stringify(source)};`;
    },
  };
}

export default defineConfig({
  plugins: [logoSvgAsText(), react(), tailwindcss()],
  resolve: {
    alias: {
      "exif-frame": resolve(__dirname, "../../packages/exif-frame/src/index.ts"),
    },
  },
  server: {
    port: 5173,
  },
});
