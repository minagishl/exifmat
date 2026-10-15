import { useRef, useState } from "react";
import { IconBrandGithub, IconCheck, IconDownload, IconHelp } from "@tabler/icons-react";
import { resolveLogo } from "exif-frame";
import type {
  CaptionDirection,
  LogoAsset,
  ExifField,
  NormalizedExif,
  TemplateId,
  TemplateRenderer,
} from "exif-frame";
import { ui } from "../lib/ui";
import { InfoDialog } from "./InfoDialog";
import { FrameSection } from "./FrameSection";
import { SidebarSection, UiField, UiParam, UiSubheading, UiToggle } from "./sidebar-ui";

const GITHUB_HREF = "https://github.com/minagishl/exif-frame";
const GITHUB_LABEL = "GitHub";

interface SidebarProps {
  templates: TemplateRenderer[];
  template: TemplateId;
  onTemplateChange: (id: TemplateId) => void;
  showLogo: boolean;
  onShowLogoChange: (v: boolean) => void;
  colorLogo: boolean;
  onColorLogoChange: (v: boolean) => void;
  /** Selected logo id, or "auto" to match from EXIF. */
  logoId: string;
  onLogoIdChange: (id: string) => void;
  logos: LogoAsset[];
  stripBrandFromModel: boolean;
  onStripBrandFromModelChange: (v: boolean) => void;
  captionDirection: CaptionDirection;
  onCaptionDirectionChange: (v: CaptionDirection) => void;
  captionDirectionSupported: boolean;
  fields: ExifField[];
  fieldSet: Set<ExifField>;
  onToggleField: (field: ExifField) => void;
  exif: NormalizedExif;
  onExifChange: (exif: NormalizedExif) => void;
  quality: number;
  onQualityChange: (v: number) => void;
  disabled: boolean;
  rendering: boolean;
  onDownloadJpeg: () => void;
  onDownloadPng: () => void;
  zoomSlotRef?: (el: HTMLDivElement | null) => void;
  /** Photos loaded; with more than one, the whole batch can be saved as a ZIP. */
  photoCount: number;
  zipProgress: { done: number; total: number } | null;
  onDownloadZip: () => void;
  canCopy: boolean;
  canShare: boolean;
  onCopy: () => Promise<void>;
  onShare: () => Promise<void>;
}

/** Secondary export actions: same height and width rhythm, no icons. */
const subBtn = `${ui.btnOutline} min-w-0 flex-1 justify-center disabled:cursor-not-allowed disabled:opacity-40`;

type ActionState = "idle" | "working" | "done" | "failed";

function SideIcon({ side }: { side: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 16" width="24" height="16" aria-hidden className="shrink-0">
      <rect
        x="0.5"
        y="0.5"
        width="23"
        height="15"
        rx="2"
        fill="none"
        stroke="currentColor"
        opacity="0.5"
      />
      <rect x="1" y="1" width="22" height="9" rx="1" fill="currentColor" opacity="0.25" />
      <rect
        x={side === "left" ? 3 : 13}
        y="12"
        width="8"
        height="1.6"
        rx="0.8"
        fill="currentColor"
      />
    </svg>
  );
}

const FIELD_LABELS: Record<ExifField, string> = {
  camera: "Camera",
  lens: "Lens",
  focalLength: "Focal",
  aperture: "Aperture",
  shutter: "Shutter",
  iso: "ISO",
  time: "Time",
  date: "Date",
};

const METADATA_FIELDS = [
  ["make", "Make"],
  ["model", "Model"],
  ["lens", "Lens"],
  ["focalLength", "Focal"],
  ["aperture", "Aperture"],
  ["shutterSpeed", "Shutter"],
  ["iso", "ISO"],
  ["dateTime", "Date"],
] as const;

export function Sidebar({
  templates,
  template,
  onTemplateChange,
  showLogo,
  onShowLogoChange,
  colorLogo,
  onColorLogoChange,
  logoId,
  onLogoIdChange,
  logos,
  stripBrandFromModel,
  onStripBrandFromModelChange,
  captionDirection,
  onCaptionDirectionChange,
  captionDirectionSupported,
  fields,
  fieldSet,
  onToggleField,
  exif,
  onExifChange,
  quality,
  onQualityChange,
  disabled,
  rendering,
  onDownloadJpeg,
  onDownloadPng,
  zoomSlotRef,
  photoCount,
  zipProgress,
  onDownloadZip,
  canCopy,
  canShare,
  onCopy,
  onShare,
}: SidebarProps) {
  const update = (key: keyof NormalizedExif, value: string) => {
    const next: NormalizedExif = { ...exif, [key]: value || undefined };
    if (key === "make") next.makeRaw = value || undefined;
    onExifChange(next);
  };

  const infoRef = useRef<HTMLDialogElement>(null);
  const detectedLogo = resolveLogo(exif);
  const qualityPct = Math.round(quality * 100);
  const busy = disabled || rendering;
  const [format, setFormat] = useState<"jpg" | "png">("jpg");

  const [copyState, setCopyState] = useState<ActionState>("idle");
  const [shareState, setShareState] = useState<ActionState>("idle");

  /** Run an async export action and flash its outcome on the button for a moment. */
  const run = async (action: () => Promise<void>, set: (s: ActionState) => void) => {
    set("working");
    try {
      await action();
      set("done");
    } catch (err) {
      // Closing the share sheet is not an error
      set(err instanceof DOMException && err.name === "AbortError" ? "idle" : "failed");
    }
    setTimeout(() => set("idle"), 1600);
  };

  return (
    <>
      <aside
        className={[
          "flex h-full min-h-0 w-full flex-col border-t border-white/10 bg-zinc-900 lg:border-t-0",
          disabled ? "opacity-55" : "",
        ].join(" ")}
      >
        <header className="box-border flex h-12 shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3">
          <div ref={zoomSlotRef} className="flex min-w-0 items-center" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Legal"
              title="Legal"
              className={`${ui.btnOutline} w-8 justify-center px-0!`}
              onClick={() => infoRef.current?.showModal()}
            >
              <IconHelp size={15} stroke={1.75} aria-hidden />
            </button>
            <a
              href={GITHUB_HREF}
              target="_blank"
              rel="noreferrer"
              className={ui.btnOutline}
              title="github.com/minagishl/exif-frame"
            >
              <IconBrandGithub size={15} stroke={1.75} aria-hidden />
              <span>{GITHUB_LABEL}</span>
            </a>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <SidebarSection title="Frame">
            <FrameSection
              templates={templates}
              template={template}
              disabled={disabled}
              onTemplateChange={onTemplateChange}
            />
          </SidebarSection>

          <SidebarSection title="Caption">
            <div className="flex flex-col">
              <UiToggle
                label="Manufacturer logo"
                checked={showLogo}
                disabled={disabled}
                onChange={onShowLogoChange}
              />
              <label
                className={[
                  "mb-1 flex items-center justify-between gap-3 py-1.5",
                  disabled || !showLogo ? "opacity-40" : "",
                ].join(" ")}
              >
                <span className="text-xs leading-5 text-zinc-300">Logo</span>
                <select
                  value={logoId}
                  disabled={disabled || !showLogo}
                  onChange={(e) => onLogoIdChange(e.target.value)}
                  className="h-8 min-w-0 max-w-[60%] flex-1 rounded-lg border border-white/10 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none transition-colors enabled:hover:border-white/20 disabled:cursor-not-allowed"
                >
                  <option value="auto">
                    {detectedLogo ? `Auto (${detectedLogo.name})` : "Auto (not detected)"}
                  </option>
                  {logos.map((logo) => (
                    <option key={logo.id} value={logo.id}>
                      {logo.name}
                    </option>
                  ))}
                </select>
              </label>
              <UiToggle
                label="Color logo"
                checked={colorLogo}
                disabled={disabled || !showLogo}
                onChange={onColorLogoChange}
              />
              <UiToggle
                label="Hide brand in model"
                checked={stripBrandFromModel}
                disabled={disabled || !showLogo}
                onChange={onStripBrandFromModelChange}
              />
            </div>

            <div className={["mt-4", captionDirectionSupported ? "" : "opacity-45"].join(" ")}>
              <UiSubheading>Caption side</UiSubheading>
              <div className="relative flex gap-[3px] rounded-lg border border-white/10 bg-zinc-950 p-[3px]">
                <span
                  className="absolute inset-y-[3px] left-[3px] w-[calc((100%-9px)/2)] rounded-md border border-white/10 bg-zinc-800 shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-[pos=right]:translate-x-[calc(100%+3px)]"
                  data-pos={captionDirection === "rtl" ? "right" : "left"}
                  aria-hidden
                />
                <button
                  type="button"
                  disabled={disabled || !captionDirectionSupported}
                  data-active={captionDirection === "ltr" ? "true" : "false"}
                  className="relative z-10 flex min-w-0 flex-1 items-center justify-center gap-2 rounded-md px-2 py-2 text-xs font-medium text-zinc-400 transition-colors enabled:hover:text-zinc-300 data-[active=true]:text-zinc-50 disabled:cursor-not-allowed disabled:opacity-45"
                  onClick={() => onCaptionDirectionChange("ltr")}
                >
                  <SideIcon side="left" />
                  Left
                </button>
                <button
                  type="button"
                  disabled={disabled || !captionDirectionSupported}
                  data-active={captionDirection === "rtl" ? "true" : "false"}
                  className="relative z-10 flex min-w-0 flex-1 items-center justify-center gap-2 rounded-md px-2 py-2 text-xs font-medium text-zinc-400 transition-colors enabled:hover:text-zinc-300 data-[active=true]:text-zinc-50 disabled:cursor-not-allowed disabled:opacity-45"
                  onClick={() => onCaptionDirectionChange("rtl")}
                >
                  <SideIcon side="right" />
                  Right
                </button>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className={`${ui.subheading} mb-0!`}>
                  Fields{" "}
                  <span className="tabular-nums text-neutral-500">
                    {fieldSet.size}/{fields.length}
                  </span>
                </p>
                <div className="flex gap-3 text-[0.6875rem]">
                  <button
                    type="button"
                    disabled={disabled || fieldSet.size === fields.length}
                    className="text-zinc-400 transition-colors enabled:hover:text-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => fields.filter((f) => !fieldSet.has(f)).forEach(onToggleField)}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    disabled={disabled || fieldSet.size === 0}
                    className="text-zinc-400 transition-colors enabled:hover:text-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => fields.filter((f) => fieldSet.has(f)).forEach(onToggleField)}
                  >
                    None
                  </button>
                </div>
              </div>
              <div className="-mx-1.5 grid grid-cols-2 gap-x-1">
                {fields.map((field) => {
                  const on = fieldSet.has(field);
                  return (
                    <button
                      key={field}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      disabled={disabled}
                      data-active={on ? "true" : "false"}
                      onClick={() => onToggleField(field)}
                      className="group flex items-center gap-2 rounded-lg px-1.5 py-[7px] text-left text-xs text-zinc-400 transition-colors enabled:hover:bg-white/5 data-[active=true]:text-zinc-50 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <span
                        className="grid size-4 shrink-0 place-items-center rounded border border-white/20 text-zinc-900 group-data-[active=true]:border-zinc-100 group-data-[active=true]:bg-zinc-100"
                        aria-hidden
                      >
                        {on && <IconCheck size={11} stroke={3} />}
                      </span>
                      {FIELD_LABELS[field]}
                    </button>
                  );
                })}
              </div>
            </div>
          </SidebarSection>

          <SidebarSection title="Metadata">
            <div className="grid grid-cols-2 gap-x-2 gap-y-3">
              {METADATA_FIELDS.map(([key, label]) => (
                <UiField
                  key={key}
                  label={label}
                  disabled={disabled}
                  wide={key === "lens" || key === "dateTime"}
                  value={exif[key] ?? ""}
                  onChange={(value) => update(key, value)}
                />
              ))}
            </div>
          </SidebarSection>
        </div>

        <footer className="shrink-0 border-t border-white/10 bg-zinc-900 px-4 pt-3.5 pb-4">
          <div className="mb-3.5 flex items-center justify-between">
            <h2 className={ui.sectionTitle}>Export</h2>
            <div
              role="radiogroup"
              aria-label="Format"
              className="flex gap-0.5 rounded-lg border border-white/10 bg-zinc-950 p-0.5"
            >
              {(["jpg", "png"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={format === value}
                  data-active={format === value ? "true" : "false"}
                  onClick={() => setFormat(value)}
                  className="rounded-md px-2.5 py-1 text-[0.6875rem] font-semibold text-zinc-400 transition-colors enabled:hover:text-zinc-200 data-[active=true]:bg-zinc-700 data-[active=true]:text-zinc-50"
                >
                  {value.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Both panels animate their row height, so the footer resizes smoothly */}
          <div
            inert={format !== "jpg"}
            className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
              format === "jpg" ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              <UiParam
                label="Quality"
                min={50}
                max={100}
                step={1}
                disabled={disabled}
                value={qualityPct}
                format={(v) => `${v}%`}
                onChange={(v) => onQualityChange(v / 100)}
              />
            </div>
          </div>
          <div
            inert={format !== "png"}
            className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
              format === "png" ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              <p className="text-xs leading-5 text-neutral-500">Lossless, larger file size.</p>
            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-2.5 text-xs font-semibold text-zinc-900 shadow-sm transition enabled:hover:brightness-110 enabled:active:translate-y-px enabled:active:brightness-95 enabled:active:shadow-none disabled:cursor-not-allowed disabled:opacity-40"
            onClick={format === "jpg" ? onDownloadJpeg : onDownloadPng}
          >
            <IconDownload size={15} stroke={2} aria-hidden />
            {rendering && !zipProgress ? "Rendering…" : `Download ${format.toUpperCase()}`}
          </button>

          {(canCopy || canShare || photoCount > 1) && (
            <div className="mt-2 flex flex-col gap-2">
              {photoCount > 1 && (
                <button type="button" disabled={busy} className={subBtn} onClick={onDownloadZip}>
                  {zipProgress ? (
                    <>
                      Framing {zipProgress.done} / {zipProgress.total}
                      <span
                        className="ml-1 h-1 w-14 overflow-hidden rounded-full bg-zinc-600"
                        aria-hidden
                      >
                        <span
                          className="block h-full rounded-full bg-zinc-100 transition-[width] duration-200"
                          style={{ width: `${(zipProgress.done / zipProgress.total) * 100}%` }}
                        />
                      </span>
                    </>
                  ) : (
                    <>
                      Download all {photoCount}
                      <span className="font-normal text-neutral-500">ZIP</span>
                    </>
                  )}
                </button>
              )}
              {(canCopy || canShare) && (
                <div className="flex gap-2">
                  {canCopy && (
                    <button
                      type="button"
                      disabled={busy || copyState === "working"}
                      className={subBtn}
                      onClick={() => void run(onCopy, setCopyState)}
                    >
                      {copyState === "done" ? "Copied" : copyState === "failed" ? "Failed" : "Copy"}
                    </button>
                  )}
                  {canShare && (
                    <button
                      type="button"
                      disabled={busy || shareState === "working"}
                      className={subBtn}
                      onClick={() => void run(onShare, setShareState)}
                    >
                      {shareState === "failed" ? "Failed" : "Share"}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </footer>
      </aside>
      <InfoDialog ref={infoRef} />
    </>
  );
}
