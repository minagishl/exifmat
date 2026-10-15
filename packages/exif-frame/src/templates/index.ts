import type { TemplateRenderer } from "../types";
import { galleryDark, galleryDarkLens, galleryWhite, galleryWhiteLens } from "./gallery";
import { stackDark, stackRowDark, stackRowWhite, stackWhite } from "./stack";
import { splitDark, splitWhite } from "./split";
import { sidebar } from "./sidebar";
import { minimal } from "./minimal";
import { card } from "./card";
import { crestDark, crestWhite } from "./crest";
import { specDark, specWhite } from "./spec";
import {
  overlay,
  overlayCenter,
  overlayGallery,
  overlayGalleryLens,
  overlayGlass,
  overlayGlassDate,
  overlayRule,
} from "./overlay";

const registry = new Map<string, TemplateRenderer>();

function registerBuiltins(): void {
  const builtins = [
    galleryWhite,
    galleryDark,
    galleryWhiteLens,
    galleryDarkLens,
    splitDark,
    splitWhite,
    stackWhite,
    stackDark,
    stackRowWhite,
    stackRowDark,
    sidebar,
    minimal,
    card,
    crestWhite,
    crestDark,
    specWhite,
    specDark,
    overlay,
    overlayCenter,
    overlayGallery,
    overlayGalleryLens,
    overlayRule,
    overlayGlass,
    overlayGlassDate,
  ];
  for (const t of builtins) {
    registry.set(t.id, t);
  }
}

registerBuiltins();

/** Register a custom template renderer */
export function registerTemplate(template: TemplateRenderer): void {
  registry.set(template.id, template);
}

/** Get a template by id */
export function getTemplate(id: string): TemplateRenderer | undefined {
  return registry.get(id);
}

/** List all registered templates */
export function listTemplates(): TemplateRenderer[] {
  return Array.from(registry.values());
}

export const templates = {
  register: registerTemplate,
  get: getTemplate,
  list: listTemplates,
  ids: () => Array.from(registry.keys()),
};

export {
  galleryWhite,
  galleryDark,
  galleryWhiteLens,
  galleryDarkLens,
  splitDark,
  splitWhite,
  stackWhite,
  stackDark,
  stackRowWhite,
  stackRowDark,
  sidebar,
  minimal,
  card,
  crestWhite,
  crestDark,
  specWhite,
  specDark,
  overlay,
  overlayCenter,
  overlayGallery,
  overlayGalleryLens,
  overlayRule,
  overlayGlass,
  overlayGlassDate,
};
