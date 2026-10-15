import { useMemo } from "react";
import { ui } from "../lib/ui";
import type { TemplateId, TemplateRenderer } from "exif-frame";

type FrameCategory =
  | "gallery"
  | "overlay"
  | "stack"
  | "split"
  | "crest"
  | "spec"
  | "rail"
  | "other";

const CATEGORY_ORDER: { key: FrameCategory; label: string }[] = [
  { key: "gallery", label: "Gallery" },
  { key: "overlay", label: "Overlay" },
  { key: "stack", label: "Stack" },
  { key: "split", label: "Split" },
  { key: "crest", label: "Crest" },
  { key: "spec", label: "Spec" },
  { key: "rail", label: "Rail" },
  { key: "other", label: "Other" },
];

function categoryForTemplate(id: string): FrameCategory {
  if (id.startsWith("gallery")) return "gallery";
  if (id.startsWith("overlay")) return "overlay";
  if (id.startsWith("stack")) return "stack";
  if (id.startsWith("split")) return "split";
  if (id.startsWith("crest")) return "crest";
  if (id.startsWith("spec")) return "spec";
  if (id.startsWith("rail")) return "rail";
  return "other";
}

/** Schematic wireframe of a template, derived from its id. */
function FrameThumb({ id }: { id: string }) {
  const dark = id.includes("dark");
  const mat = dark ? "#141416" : "#f3f3f1";
  const ink = dark ? "#d4d4d8" : "#3f3f46";
  const photo = "#7a7a82";

  const line = (x: number, y: number, w: number, color = ink, o = 0.9) => (
    <rect x={x} y={y} width={w} height={1.4} rx={0.7} fill={color} opacity={o} />
  );
  const dot = (x: number, y: number, color = ink) => <circle cx={x} cy={y} r={1.5} fill={color} />;

  let body: React.ReactNode;
  const lens = id.includes("lens");

  if (id.startsWith("gallery")) {
    body = (
      <>
        <rect width="60" height="40" fill={mat} />
        <rect width="60" height="32" fill={photo} />
        {dot(5, 36)}
        {line(9, 35.3, 14)}
        {line(41, 33.8, 14, ink, 0.55)}
        {line(41, 36.6, lens ? 14 : 9, ink, 0.55)}
      </>
    );
  } else if (id.startsWith("stack-row")) {
    body = (
      <>
        <rect width="60" height="40" fill={mat} />
        <rect x="6" y="5" width="48" height="23" fill={photo} />
        {dot(14, 34)}
        {line(19, 33.3, 12)}
        {line(34, 33.3, 12, ink, 0.55)}
      </>
    );
  } else if (id.startsWith("stack")) {
    body = (
      <>
        <rect width="60" height="40" fill={mat} />
        <rect x="6" y="5" width="48" height="22" fill={photo} />
        {line(18, 30.6, 24)}
        {line(21, 34.4, 18, ink, 0.55)}
      </>
    );
  } else if (id.startsWith("split")) {
    body = (
      <>
        <rect width="60" height="40" fill={mat} />
        <rect width="60" height="31" fill={photo} />
        {dot(5, 35.5)}
        {line(9, 34.8, 14)}
        {line(38, 34.8, 17, ink, 0.55)}
      </>
    );
  } else if (id.startsWith("crest")) {
    body = (
      <>
        <rect width="60" height="40" fill={mat} />
        {dot(30, 5)}
        <rect x="7" y="9" width="46" height="20" fill={photo} />
        {line(20, 32.6, 20)}
        {line(23, 36, 14, ink, 0.55)}
      </>
    );
  } else if (id.startsWith("spec")) {
    body = (
      <>
        <rect width="60" height="40" fill={mat} />
        <rect x="4" y="4" width="52" height="21" fill={photo} />
        {dot(6, 29)}
        {line(10, 28.3, 12)}
        {line(38, 28.3, 16, ink, 0.55)}
        <rect x="4" y="31" width="52" height="0.5" fill={ink} opacity="0.3" />
        {line(4, 34, 6, ink, 0.45)}
        {line(19, 34, 8, ink, 0.45)}
        {line(34, 34, 7, ink, 0.45)}
        {line(47, 34, 5, ink, 0.45)}
        {line(4, 36.6, 8)}
        {line(19, 36.6, 8)}
        {line(34, 36.6, 8)}
        {line(47, 36.6, 5)}
      </>
    );
  } else if (id.startsWith("rail")) {
    body = (
      <>
        <rect width="60" height="40" fill={mat} />
        <rect x="5" y="5" width="43" height="30" fill={photo} />
        <rect x="52" y="14" width="1.4" height="21" rx="0.7" fill={ink} opacity="0.9" />
        <rect x="55" y="22" width="1.4" height="13" rx="0.7" fill={ink} opacity="0.55" />
        <circle cx="52.7" cy="10" r="1.5" fill={ink} />
      </>
    );
  } else if (id === "minimal") {
    body = (
      <>
        <rect width="60" height="40" fill={mat} />
        <rect x="8" y="5" width="44" height="25" fill={photo} />
        {line(21, 34.5, 18, ink, 0.6)}
      </>
    );
  } else if (id === "card") {
    body = (
      <>
        <rect width="60" height="40" fill={mat} />
        <rect x="7" y="5" width="46" height="24" rx="3" fill={photo} />
        {line(19, 32.6, 22)}
        {line(23, 36, 14, ink, 0.55)}
      </>
    );
  } else if (id === "sidebar") {
    body = (
      <>
        <rect width="60" height="40" fill={mat} />
        <rect x="4" y="4" width="40" height="32" fill={photo} />
        {dot(50, 8)}
        {line(47, 15, 10)}
        {line(47, 19, 7, ink, 0.55)}
        {line(47, 23, 9, ink, 0.55)}
      </>
    );
  } else {
    // overlay family: full-bleed photo with caption on top
    const center = id === "overlay-center";
    const glass = id.startsWith("overlay-glass");
    body = (
      <>
        <rect width="60" height="40" fill={photo} />
        {glass ? (
          <rect y="29" width="60" height="11" fill="#fff" opacity="0.22" />
        ) : (
          <rect y="22" width="60" height="18" fill="#000" opacity="0.4" />
        )}
        {id === "overlay-glass-date" && <rect width="60" height="8" fill="#fff" opacity="0.22" />}
        {id === "overlay-rule" && (
          <rect x="5" y="28" width="50" height="0.6" fill="#fff" opacity="0.8" />
        )}
        {center ? (
          <>
            {line(19, 31, 22, "#fff")}
            {line(23, 35, 14, "#fff", 0.65)}
          </>
        ) : (
          <>
            {dot(6, 33, "#fff")}
            {line(10, 32.3, 14, "#fff")}
            {line(40, 31, 15, "#fff", 0.65)}
            {line(40, 34.6, 10, "#fff", 0.65)}
          </>
        )}
      </>
    );
  }

  return (
    <svg viewBox="0 0 60 40" className="block w-full" aria-hidden>
      {body}
    </svg>
  );
}

interface FrameSectionProps {
  templates: TemplateRenderer[];
  template: TemplateId;
  disabled: boolean;
  onTemplateChange: (id: TemplateId) => void;
}

export function FrameSection({
  templates,
  template,
  disabled,
  onTemplateChange,
}: FrameSectionProps) {
  const groups = useMemo(() => {
    const map = new Map<FrameCategory, TemplateRenderer[]>();
    for (const c of CATEGORY_ORDER) map.set(c.key, []);
    for (const t of templates) map.get(categoryForTemplate(t.id))?.push(t);
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return CATEGORY_ORDER.map((c) => ({ ...c, items: map.get(c.key) ?? [] })).filter(
      (g) => g.items.length > 0,
    );
  }, [templates]);

  return (
    <div className="flex flex-col gap-3.5" role="listbox" aria-label="Frame templates">
      {groups.map((g) => (
        <div key={g.key}>
          <p className={ui.subheading}>{g.label}</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-x-1 gap-y-0.5">
            {g.items.map((t) => {
              const active = t.id === template;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  disabled={disabled}
                  data-active={active ? "true" : "false"}
                  title={t.description}
                  className="group flex min-w-0 items-center gap-2 rounded-md px-1.5 py-[5px] text-left transition-colors enabled:not-data-[active=true]:hover:bg-white/5 data-[active=true]:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-45"
                  onClick={() => onTemplateChange(t.id as TemplateId)}
                >
                  <span className="block w-9 shrink-0 overflow-hidden rounded-[2px] outline outline-1 outline-white/10">
                    <FrameThumb id={t.id} />
                  </span>
                  <span className="truncate text-xs text-zinc-400 group-data-[active=true]:font-semibold group-data-[active=true]:text-zinc-900">
                    {t.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
