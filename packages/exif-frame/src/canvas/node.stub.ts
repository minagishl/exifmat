import type { CanvasEnvironment } from "./types";

/** Browser stub — Node canvas adapter is never used in the browser. */
export async function createNodeEnvironment(): Promise<CanvasEnvironment> {
  throw new Error("Node canvas adapter is not available in the browser");
}
