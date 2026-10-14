import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  createFrame,
  listTemplates,
  parseExif,
  type CaptionDirection,
  type ExifField,
  type NormalizedExif,
  type TemplateId,
} from "exif-frame";
import { ImagePanel } from "./components/ImagePanel";
import {
  clampSidebarWidth,
  DEFAULT_SIDEBAR_WIDTH,
  ResizeDivider,
} from "./components/ResizeDivider";
import { Sidebar } from "./components/Sidebar";
import { ensureFontsLoaded, FRAME_FONT_FAMILY } from "./lib/fonts";

const ALL_FIELDS: ExifField[] = [
  "camera",
  "lens",
  "focalLength",
  "aperture",
  "shutter",
  "iso",
  "time",
  "date",
];

const DATETIME_FIELDS: ExifField[] = ["time", "date"];

/** Demo-only: hide time+date by default for these templates (still toggleable). */
const DATE_OFF_BY_DEFAULT = new Set<TemplateId>([
  "stack-white",
  "stack-dark",
  "stack-row-white",
  "stack-row-dark",
  "sidebar",
  "overlay",
  "overlay-center",
]);

/** Templates with left/right caption groups that honor captionDirection. */
const CAPTION_DIRECTION_SUPPORTED = new Set<TemplateId>([
  "gallery-white",
  "gallery-dark",
  "gallery-white-lens",
  "gallery-dark-lens",
  "split-dark",
  "split-white",
  "minimal",
  "sidebar",
  "overlay",
  "overlay-gallery",
  "overlay-gallery-lens",
  "overlay-rule",
  "overlay-glass",
  "overlay-glass-date",
]);

function defaultFieldsFor(template: TemplateId): ExifField[] {
  if (DATE_OFF_BY_DEFAULT.has(template)) {
    return ALL_FIELDS.filter((field) => !DATETIME_FIELDS.includes(field));
  }
  return [...ALL_FIELDS];
}

const QUALITY_DEBOUNCE_MS = 400;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const templates = listTemplates();

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [exif, setExif] = useState<NormalizedExif>({});
  const [template, setTemplate] = useState<TemplateId>("gallery-dark");
  const [showLogo, setShowLogo] = useState(true);
  const [colorLogo, setColorLogo] = useState(false);
  const [stripBrandFromModel, setStripBrandFromModel] = useState(true);
  const [fields, setFields] = useState<ExifField[]>(() => defaultFieldsFor("gallery-dark"));
  const [quality, setQuality] = useState(0.92);
  const [captionDirection, setCaptionDirection] = useState<CaptionDirection>("ltr");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomSlot, setZoomSlot] = useState<HTMLElement | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(() => clampSidebarWidth(DEFAULT_SIDEBAR_WIDTH));

  const previewQuality = useDebouncedValue(quality, QUALITY_DEBOUNCE_MS);

  const fieldSet = useMemo(() => new Set(fields), [fields]);

  useEffect(() => {
    const onResize = () => {
      setSidebarWidth((w) => clampSidebarWidth(w));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onFile = useCallback(async (next: File) => {
    setError(null);
    setFile(next);
    try {
      const parsed = await parseExif(next);
      setExif(parsed);
    } catch {
      setExif({});
    }
  }, []);

  useEffect(() => {
    if (!file) return;

    let cancelled = false;

    const run = async () => {
      setRendering(true);
      setError(null);
      try {
        await ensureFontsLoaded();
        const result = await createFrame({
          image: file,
          filename: file.name,
          template,
          options: {
            showLogo,
            colorLogo,
            stripBrandFromModel,
            fields,
            exif,
            fontFamily: FRAME_FONT_FAMILY,
            maxWidth: 1600,
            quality: previewQuality,
            captionDirection,
          },
        });
        if (cancelled) return;
        const blob = await result.toBlob("image/jpeg");
        const nextUrl = URL.createObjectURL(blob);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return nextUrl;
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render frame");
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    file,
    template,
    showLogo,
    colorLogo,
    stripBrandFromModel,
    fields,
    exif,
    previewQuality,
    captionDirection,
  ]);

  const toggleField = (field: ExifField) => {
    setFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return ALL_FIELDS.filter((f) => next.has(f));
    });
  };

  const onTemplateChange = (id: TemplateId) => {
    const wasDateOff = DATE_OFF_BY_DEFAULT.has(template);
    const nowDateOff = DATE_OFF_BY_DEFAULT.has(id);
    setTemplate(id);
    if (!wasDateOff && nowDateOff) {
      setFields((prev) => prev.filter((f) => !DATETIME_FIELDS.includes(f)));
    } else if (wasDateOff && !nowDateOff) {
      setFields((prev) => {
        const next = new Set(prev);
        for (const f of DATETIME_FIELDS) next.add(f);
        return ALL_FIELDS.filter((f) => next.has(f));
      });
    }
  };

  const download = async (type: "image/jpeg" | "image/png") => {
    if (!file) return;
    setRendering(true);
    try {
      await ensureFontsLoaded();
      const result = await createFrame({
        image: file,
        template,
        options: {
          showLogo,
          colorLogo,
          stripBrandFromModel,
          fields,
          exif,
          fontFamily: FRAME_FONT_FAMILY,
          quality,
          captionDirection,
        },
      });
      const blob = await result.toBlob(type);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `exif-frame.${type === "image/png" ? "png" : "jpg"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setRendering(false);
    }
  };

  const sidebar = (
    <Sidebar
      zoomSlotRef={setZoomSlot}
      templates={templates}
      template={template}
      onTemplateChange={onTemplateChange}
      showLogo={showLogo}
      onShowLogoChange={setShowLogo}
      colorLogo={colorLogo}
      onColorLogoChange={setColorLogo}
      stripBrandFromModel={stripBrandFromModel}
      onStripBrandFromModelChange={setStripBrandFromModel}
      captionDirection={captionDirection}
      onCaptionDirectionChange={setCaptionDirection}
      captionDirectionSupported={CAPTION_DIRECTION_SUPPORTED.has(template)}
      fields={ALL_FIELDS}
      fieldSet={fieldSet}
      onToggleField={toggleField}
      exif={exif}
      onExifChange={setExif}
      quality={quality}
      onQualityChange={setQuality}
      disabled={!file}
      rendering={rendering}
      onDownloadJpeg={() => void download("image/jpeg")}
      onDownloadPng={() => void download("image/png")}
    />
  );

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-zinc-900)] lg:h-screen lg:flex-row lg:overflow-hidden">
      <div className="flex min-h-[min(100vh,720px)] min-w-0 flex-1 flex-col lg:min-h-0">
        <ImagePanel
          zoomSlot={zoomSlot}
          hasFile={file !== null}
          url={previewUrl}
          rendering={rendering}
          error={error}
          onFile={onFile}
          onClear={() => {
            setFile(null);
            setExif({});
            setPreviewUrl(null);
          }}
        />
      </div>

      <ResizeDivider sidebarWidth={sidebarWidth} onWidthChange={setSidebarWidth} />

      <div
        className="w-full lg:w-[var(--sidebar-width,380px)] shrink-0 lg:flex lg:h-full lg:max-h-screen lg:flex-col lg:overflow-hidden"
        style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
      >
        {sidebar}
      </div>
    </div>
  );
}
