/**
 * Logo SVG sources — imported as text, inlined at build time by Bun.
 * Edit files under ./files/; do not paste markup here.
 */
import alpa from "./files/alpa.svg" with { type: "text" };
import apple from "./files/apple.svg" with { type: "text" };
import arri from "./files/arri.svg" with { type: "text" };
import canon from "./files/canon.svg" with { type: "text" };
import dji from "./files/dji.svg" with { type: "text" };
import fujifilm from "./files/fujifilm.svg" with { type: "text" };
import google from "./files/google.svg" with { type: "text" };
import gopro from "./files/gopro.svg" with { type: "text" };
import hasselblad from "./files/hasselblad.svg" with { type: "text" };
import insta360 from "./files/insta360.svg" with { type: "text" };
import leica from "./files/leica.svg" with { type: "text" };
import linhof from "./files/linhof.svg" with { type: "text" };
import mamiya from "./files/mamiya.svg" with { type: "text" };
import nikon from "./files/nikon.svg" with { type: "text" };
import olympus from "./files/olympus.svg" with { type: "text" };
import omSystem from "./files/om-system.svg" with { type: "text" };
import panasonic from "./files/panasonic.svg" with { type: "text" };
import phaseOne from "./files/phase-one.svg" with { type: "text" };
import red from "./files/red.svg" with { type: "text" };
import ricoh from "./files/ricoh.svg" with { type: "text" };
import rollei from "./files/rollei.svg" with { type: "text" };
import samsung from "./files/samsung.svg" with { type: "text" };
import sigma from "./files/sigma.svg" with { type: "text" };
import sony from "./files/sony.svg" with { type: "text" };
import tamron from "./files/tamron.svg" with { type: "text" };
import tokina from "./files/tokina.svg" with { type: "text" };
import xiaomi from "./files/xiaomi.svg" with { type: "text" };
import zeiss from "./files/zeiss.svg" with { type: "text" };

import { LOGO_NAMES } from "./catalog";

const RAW: Record<string, string> = {
  alpa,
  apple,
  arri,
  canon,
  dji,
  fujifilm,
  google,
  gopro,
  hasselblad,
  insta360,
  leica,
  linhof,
  mamiya,
  nikon,
  olympus,
  "om-system": omSystem,
  panasonic,
  "phase-one": phaseOne,
  red,
  ricoh,
  rollei,
  samsung,
  sigma,
  sony,
  tamron,
  tokina,
  xiaomi,
  zeiss,
};

function aspectOf(svg: string): number {
  const vb = /viewBox=["']([^"']+)["']/i.exec(svg);
  if (vb) {
    const parts = vb[1]!
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (parts.length === 4 && parts[2]! > 0 && parts[3]! > 0) {
      return Math.round((parts[2]! / parts[3]!) * 1000) / 1000;
    }
  }
  const w = /(?:\s|^)width=["']([0-9.]+)/i.exec(svg);
  const h = /(?:\s|^)height=["']([0-9.]+)/i.exec(svg);
  if (w && h) {
    const wn = Number(w[1]);
    const hn = Number(h[1]);
    if (wn > 0 && hn > 0) return Math.round((wn / hn) * 1000) / 1000;
  }
  return 1;
}

export const LOGO_SVGS: Record<string, { name: string; aspect: number; svg: string }> =
  Object.fromEntries(
    Object.entries(RAW).map(([id, svg]) => [
      id,
      {
        name: LOGO_NAMES[id] ?? id,
        aspect: aspectOf(svg),
        svg,
      },
    ]),
  );
