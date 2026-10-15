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
import { loadSettings, saveSettings } from "./lib/settings";
import { createZip, type ZipEntry } from "./lib/zip";

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
  "spec-white",
  "spec-dark",
  "rail-white",
  "rail-dark",
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

/** Options remembered from the previous visit (validated against what exists now). */
const saved = loadSettings(
  templates.map((t) => t.id),
  ALL_FIELDS,
);

function baseName(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el?.closest("input, textarea, select, [contenteditable='true']"));
}

export default function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [index, setIndex] = useState(0);
  const file = files[index] ?? null;
  const [exif, setExif] = useState<NormalizedExif>({});
  const [template, setTemplate] = useState<TemplateId>(
    (saved.template as TemplateId | undefined) ?? "gallery-dark",
  );
  const [showLogo, setShowLogo] = useState(saved.showLogo ?? true);
  const [colorLogo, setColorLogo] = useState(saved.colorLogo ?? false);
  const [stripBrandFromModel, setStripBrandFromModel] = useState(saved.stripBrandFromModel ?? true);
  const [fields, setFields] = useState<ExifField[]>(
    () => saved.fields ?? defaultFieldsFor((saved.template as TemplateId) ?? "gallery-dark"),
  );
  const [quality, setQuality] = useState(saved.quality ?? 0.92);
  const [captionDirection, setCaptionDirection] = useState<CaptionDirection>(
    saved.captionDirection ?? "ltr",
  );
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomSlot, setZoomSlot] = useState<HTMLElement | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    clampSidebarWidth(saved.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH),
  );

  const previewQuality = useDebouncedValue(quality, QUALITY_DEBOUNCE_MS);

  const fieldSet = useMemo(() => new Set(fields), [fields]);

  useEffect(() => {
    const onResize = () => {
      setSidebarWidth((w) => clampSidebarWidth(w));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    saveSettings({
      template,
      showLogo,
      colorLogo,
      stripBrandFromModel,
      fields,
      quality,
      captionDirection,
      sidebarWidth,
    });
  }, [
    template,
    showLogo,
    colorLogo,
    stripBrandFromModel,
    fields,
    quality,
    captionDirection,
    sidebarWidth,
  ]);

  const onFiles = useCallback((next: File[]) => {
    if (next.length === 0) return;
    setError(null);
    setFiles(next);
    setIndex(0);
  }, []);

  const step = useCallback(
    (delta: number) => {
      setIndex((i) => Math.max(0, Math.min(files.length - 1, i + delta)));
    },
    [files.length],
  );

  // Read EXIF whenever the current photo changes
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    parseExif(file)
      .then((parsed) => {
        if (!cancelled) setExif(parsed);
      })
      .catch(() => {
        if (!cancelled) setExif({});
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  // ← / → switch photos in a batch
  useEffect(() => {
    if (files.length < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (isInteractiveTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [files.length, step]);

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

  const renderBlob = async (
    source: File,
    type: "image/jpeg" | "image/png",
    exifOverride: NormalizedExif,
  ): Promise<Blob> => {
    await ensureFontsLoaded();
    const result = await createFrame({
      image: source,
      filename: source.name,
      template,
      options: {
        showLogo,
        colorLogo,
        stripBrandFromModel,
        fields,
        exif: exifOverride,
        fontFamily: FRAME_FONT_FAMILY,
        quality,
        captionDirection,
      },
    });
    return result.toBlob(type);
  };

  const outputName = (source: File, type: "image/jpeg" | "image/png") =>
    `${baseName(source.name)}-framed.${type === "image/png" ? "png" : "jpg"}`;

  const withRendering = async (task: () => Promise<void>, fallback: string) => {
    setRendering(true);
    try {
      await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setRendering(false);
    }
  };

  const download = (type: "image/jpeg" | "image/png") => {
    if (!file) return;
    void withRendering(async () => {
      const blob = await renderBlob(file, type, exif);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = outputName(file, type);
      a.click();
      URL.revokeObjectURL(url);
    }, "Download failed");
  };

  /** Frame every photo in the batch with the current options and save one ZIP. */
  const downloadZip = async () => {
    if (files.length < 2) return;
    setRendering(true);
    setZipProgress({ done: 0, total: files.length });
    try {
      const entries: ZipEntry[] = [];
      const used = new Set<string>();
      for (let i = 0; i < files.length; i++) {
        const source = files[i]!;
        // The photo being edited keeps its edited metadata
        const meta = i === index ? exif : await parseExif(source).catch(() => ({}));
        const blob = await renderBlob(source, "image/jpeg", meta);
        let name = outputName(source, "image/jpeg");
        for (let n = 2; used.has(name); n++) {
          name = `${baseName(source.name)}-framed-${n}.jpg`;
        }
        used.add(name);
        entries.push({ name, data: new Uint8Array(await blob.arrayBuffer()) });
        setZipProgress({ done: i + 1, total: files.length });
      }
      const url = URL.createObjectURL(createZip(entries));
      const a = document.createElement("a");
      a.href = url;
      a.download = "exif-frame.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setZipProgress(null);
      setRendering(false);
    }
  };

  /** Copy the framed image to the clipboard (PNG is the only widely supported type). */
  const copyImage = async () => {
    if (!file) return;
    const blob = await renderBlob(file, "image/png", exif);
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  };

  const shareImage = async () => {
    if (!file) return;
    const blob = await renderBlob(file, "image/jpeg", exif);
    const shared = new File([blob], outputName(file, "image/jpeg"), { type: "image/jpeg" });
    if (!navigator.canShare?.({ files: [shared] })) throw new Error("Sharing is not supported");
    await navigator.share({ files: [shared] });
  };

  const canCopy = typeof ClipboardItem !== "undefined" && Boolean(navigator.clipboard?.write);
  const canShare =
    typeof navigator.share === "function" && typeof navigator.canShare === "function";

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
      onDownloadJpeg={() => download("image/jpeg")}
      onDownloadPng={() => download("image/png")}
      photoCount={files.length}
      zipProgress={zipProgress}
      onDownloadZip={() => void downloadZip()}
      canCopy={canCopy}
      canShare={canShare}
      onCopy={copyImage}
      onShare={shareImage}
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
          count={files.length}
          index={index}
          originalFile={file}
          onStep={step}
          onFiles={onFiles}
          onClear={() => {
            setFiles([]);
            setIndex(0);
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
