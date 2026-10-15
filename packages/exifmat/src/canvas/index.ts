import type { CanvasEnvironment } from "./types";
import { isBrowser } from "./types";
import { createBrowserEnvironment } from "./browser";

let envPromise: Promise<CanvasEnvironment> | null = null;

async function loadNodeEnvironment(): Promise<CanvasEnvironment> {
  // Hide the specifier from static bundler analysis (Vite/Rollup)
  const dynImport = new Function("s", "return import(s)") as (
    s: string,
  ) => Promise<{ createNodeEnvironment: () => Promise<CanvasEnvironment> }>;

  // Source (bun test): ./node.ts
  // Unbundled dist/canvas/index.js: ./node.js
  // Bundled dist/index.js: ./canvas/node.js
  const candidates = [
    new URL("./node.ts", import.meta.url).href,
    new URL("./node.js", import.meta.url).href,
    new URL("./canvas/node.js", import.meta.url).href,
  ];

  let lastError: unknown;
  for (const href of candidates) {
    try {
      const mod = await dynImport(href);
      return mod.createNodeEnvironment();
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Failed to load Node canvas adapter");
}

/** Resolve the canvas environment for the current runtime */
export function getCanvasEnvironment(): Promise<CanvasEnvironment> {
  if (!envPromise) {
    envPromise = isBrowser() ? Promise.resolve(createBrowserEnvironment()) : loadNodeEnvironment();
  }
  return envPromise;
}

/** Override the canvas environment (useful for tests) */
export function setCanvasEnvironment(env: CanvasEnvironment | null): void {
  envPromise = env ? Promise.resolve(env) : null;
}

// Clear cached env on Vite HMR so loader fixes apply without a full reload
try {
  const meta = import.meta as ImportMeta & {
    hot?: { dispose: (cb: () => void) => void };
  };
  meta.hot?.dispose(() => {
    envPromise = null;
  });
} catch {
  // ignore
}

export { isBrowser } from "./types";
export type { CanvasEnvironment } from "./types";
