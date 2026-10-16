import {
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  IconChevronLeft,
  IconChevronRight,
  IconPhotoPlus,
  IconZoomIn,
  IconZoomOut,
  IconZoomReset,
} from "@tabler/icons-react";
import { ui } from "../lib/ui";
import { ACCEPT_ATTR, isAcceptedPhoto } from "../lib/files";

const MIN_SCALE = 0.35;
const MAX_SCALE = 5;
const ZOOM_STEP = 1.12;

interface ImagePanelProps {
  hasFile: boolean;
  url: string | null;
  rendering: boolean;
  error: string | null;
  /** Number of photos in the batch and the one being shown. */
  count: number;
  index: number;
  onStep: (delta: number) => void;
  /** The photo being shown, for the hold-to-compare original. */
  originalFile: File | null;
  onFiles: (files: File[]) => void;
  onClear: () => void;
  /** On small screens the zoom controls render here (the sidebar header). */
  zoomSlot?: HTMLElement | null;
}

const COMPACT_QUERY = "(max-width: 63.999rem)";

function useIsCompact(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(COMPACT_QUERY);
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia(COMPACT_QUERY).matches,
    () => false,
  );
}

function clampScale(value: number): number {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, value));
}

function isFileDrag(e: DragEvent): boolean {
  return [...e.dataTransfer.types].includes("Files");
}

export function ImagePanel({
  hasFile,
  url,
  rendering,
  error,
  count,
  index,
  onStep,
  originalFile,
  onFiles,
  onClear,
  zoomSlot,
}: ImagePanelProps) {
  const inHeader = useIsCompact();
  const inputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [scale, setScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [panning, setPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const resetView = useCallback(() => {
    setScale(1);
    setPanX(0);
    setPanY(0);
  }, []);

  // Reset zoom/pan whenever the preview image changes (adjust state during render).
  const [viewUrl, setViewUrl] = useState(url);
  if (viewUrl !== url) {
    setViewUrl(url);
    setScale(1);
    setPanX(0);
    setPanY(0);
  }

  const accept = useCallback(
    (list: FileList | File[] | null | undefined) => {
      const photos = Array.from(list ?? []).filter(isAcceptedPhoto);
      if (photos.length > 0) onFiles(photos);
    },
    [onFiles],
  );

  // Hold-to-compare: the unframed original replaces the preview while pressed.
  // Only formats the browser can decode natively (RAW cannot be shown directly).
  const [compareUrl, setCompareUrl] = useState<string | null>(null);
  const canCompare = Boolean(originalFile && /^image\/(jpeg|png|webp)$/.test(originalFile.type));
  const startCompare = () => {
    if (!originalFile || !canCompare) return;
    setCompareUrl(URL.createObjectURL(originalFile));
  };
  const endCompare = () => {
    setCompareUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  };

  const onDragOver = (e: DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = (e: DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragActive(false);
  };

  const onDrop = (e: DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    setDragActive(false);
    accept(e.dataTransfer.files);
  };

  const openPicker = () => inputRef.current?.click();

  const zoomAt = useCallback((clientX: number, clientY: number, factor: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const cx = clientX - rect.left - rect.width / 2;
    const cy = clientY - rect.top - rect.height / 2;

    setScale((prevScale) => {
      const nextScale = clampScale(prevScale * factor);
      const ratio = nextScale / prevScale;
      if (ratio === 1) return prevScale;
      setPanX((px) => px - cx * (ratio - 1));
      setPanY((py) => py - cy * (ratio - 1));
      return nextScale;
    });
  }, []);

  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    if (!url) return;
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    const factor = Math.exp(-Math.max(-120, Math.min(120, delta)) * 0.0018);
    zoomAt(e.clientX, e.clientY, factor);
  };

  const onViewportPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!url || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    panStartRef.current = { x: e.clientX, y: e.clientY, panX, panY };
    setPanning(true);
  };

  const onViewportPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!panStartRef.current) return;
    const { x, y, panX: startPanX, panY: startPanY } = panStartRef.current;
    setPanX(startPanX + (e.clientX - x));
    setPanY(startPanY + (e.clientY - y));
  };

  const endPan = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!panStartRef.current) return;
    panStartRef.current = null;
    setPanning(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const zoomToolbar = (className: string) => (
    <div
      className={`flex h-8 items-center gap-0.5 rounded-lg border border-white/10 bg-zinc-800/70 p-[3px] shadow-[0_8px_24px_rgb(0_0_0/0.35)] backdrop-blur-[14px] backdrop-saturate-[1.3] ${className}`}
    >
      <button
        type="button"
        aria-label="Zoom out"
        onClick={(e) => {
          e.stopPropagation();
          const rect = viewportRef.current?.getBoundingClientRect();
          if (rect) {
            zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1 / ZOOM_STEP);
          }
        }}
        className={ui.btnIcon}
      >
        <IconZoomOut size={16} stroke={1.75} />
      </button>
      <span className="min-w-[2.75rem] px-1 text-center text-xs tabular-nums text-neutral-400">
        {Math.round(scale * 100)}%
      </span>
      <button
        type="button"
        aria-label="Zoom in"
        onClick={(e) => {
          e.stopPropagation();
          const rect = viewportRef.current?.getBoundingClientRect();
          if (rect) {
            zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, ZOOM_STEP);
          }
        }}
        className={ui.btnIcon}
      >
        <IconZoomIn size={16} stroke={1.75} />
      </button>
      <button
        type="button"
        aria-label="Reset zoom and position"
        disabled={scale === 1 && panX === 0 && panY === 0}
        onClick={(e) => {
          e.stopPropagation();
          resetView();
        }}
        className={`${ui.btnIcon} disabled:opacity-40`}
      >
        <IconZoomReset size={16} stroke={1.75} />
      </button>
    </div>
  );

  return (
    <div
      role={hasFile ? undefined : "button"}
      tabIndex={hasFile ? undefined : 0}
      onKeyDown={
        hasFile
          ? undefined
          : (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openPicker();
              }
            }
      }
      onClick={hasFile ? undefined : openPicker}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={[
        "group/drop relative flex h-full min-h-[min(100dvh,720px)] flex-1 flex-col bg-zinc-950 [background-image:radial-gradient(120%_80%_at_50%_0%,rgb(255_255_255/0.035),transparent_60%),radial-gradient(circle_at_1px_1px,rgb(255_255_255/0.045)_1px,transparent_0)] [background-size:100%_100%,20px_20px]",
        !hasFile ? "cursor-pointer" : "",
        dragActive ? "ring-2 ring-inset ring-[var(--color-blue-500)]/60" : "",
      ].join(" ")}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        multiple
        className="hidden"
        onChange={(e) => {
          accept(e.target.files);
          e.target.value = "";
        }}
      />

      {error && (
        <p className="absolute top-4 right-4 left-4 z-10 rounded-md bg-red-950/90 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      )}

      {!hasFile ? (
        <div className="flex flex-1 items-center justify-center px-8">
          <div className="flex max-w-[26rem] flex-col items-center text-center">
            <div
              className={[
                "mb-5 transition-colors",
                dragActive ? "text-blue-400" : "text-blue-500",
              ].join(" ")}
            >
              <IconPhotoPlus size={40} stroke={1.75} aria-hidden />
            </div>
            <p className="text-[0.9375rem] font-medium tracking-tight text-neutral-100">
              {dragActive ? "Release to import" : "Drop photos to frame them"}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-400">
              or click to browse your files — several at once works too
            </p>
            <p className="mt-5 max-w-xs text-xs leading-relaxed text-neutral-500">
              JPEG, PNG, WebP, or camera RAW. EXIF stays in your browser — nothing is uploaded.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="absolute top-6 right-3 z-20 flex -translate-y-1/2 items-center gap-2">
            {count > 1 && (
              <div className="flex h-8 items-center rounded-lg border border-white/10 bg-zinc-800 p-[3px] text-xs text-zinc-200">
                <button
                  type="button"
                  aria-label="Previous photo"
                  disabled={index === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStep(-1);
                  }}
                  className={ui.btnIcon}
                >
                  <IconChevronLeft size={16} stroke={1.75} />
                </button>
                <span className="min-w-[3rem] px-1 text-center tabular-nums">
                  {index + 1} / {count}
                </span>
                <button
                  type="button"
                  aria-label="Next photo"
                  disabled={index === count - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStep(1);
                  }}
                  className={ui.btnIcon}
                >
                  <IconChevronRight size={16} stroke={1.75} />
                </button>
              </div>
            )}
            {canCompare && url && (
              <button
                type="button"
                title="Hold to see the original"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  startCompare();
                }}
                onPointerUp={endCompare}
                onPointerCancel={endCompare}
                onKeyDown={(e) => {
                  if ((e.key === " " || e.key === "Enter") && !e.repeat) startCompare();
                }}
                onKeyUp={endCompare}
                onBlur={endCompare}
                className={ui.btnOutline}
              >
                Original
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openPicker();
              }}
              className={ui.btnOutline}
            >
              Replace
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className={ui.btnOutline}
            >
              Clear
            </button>
          </div>

          <div
            ref={viewportRef}
            className={[
              "relative min-h-0 flex-1 touch-none overflow-hidden",
              panning ? "cursor-grabbing" : url ? "cursor-grab" : "cursor-default",
            ].join(" ")}
            onWheel={onWheel}
            onPointerDown={onViewportPointerDown}
            onPointerMove={onViewportPointerMove}
            onPointerUp={endPan}
            onPointerCancel={endPan}
          >
            <div className="absolute inset-0 flex items-center justify-center p-6 md:p-10">
              {url ? (
                <img
                  src={compareUrl ?? url}
                  alt={compareUrl ? "Original photo" : "Framed preview"}
                  draggable={false}
                  className="max-h-full max-w-full select-none object-contain rounded-[2px] shadow-[0_24px_60px_-12px_rgb(0_0_0/0.6),0_0_0_1px_rgb(255_255_255/0.05)]"
                  style={{
                    transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
                    transformOrigin: "center center",
                    transition: panning ? "none" : "transform 140ms cubic-bezier(0.2, 0.7, 0.2, 1)",
                    willChange: "transform",
                  }}
                />
              ) : (
                <div className="h-48 w-72 animate-pulse rounded-lg bg-neutral-800/80" />
              )}
            </div>
          </div>

          {url && !inHeader && zoomToolbar("absolute bottom-4 left-4 z-20")}
          {url && inHeader && zoomSlot && createPortal(zoomToolbar(""), zoomSlot)}

          {dragActive && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
              <p className="rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-100 shadow-xl ring-1 ring-white/10">
                Drop to replace
              </p>
            </div>
          )}

          {rendering && (
            <div
              role="status"
              aria-label="Rendering"
              className={[
                "pointer-events-none absolute inset-0 z-10 flex items-center justify-center",
                url ? "bg-black/25" : "",
              ].join(" ")}
            >
              <span
                className="block size-11 animate-spin rounded-full"
                style={{
                  background: "conic-gradient(from 0deg, transparent 0%, #fff 100%)",
                  mask: "radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px))",
                  WebkitMask:
                    "radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px))",
                }}
                aria-hidden
              />
            </div>
          )}

          {!dragActive && (
            <p className="pointer-events-none absolute bottom-4 left-1/2 z-10 max-w-md -translate-x-1/2 px-4 text-center text-[0.6875rem] text-neutral-600">
              Scroll to zoom. Drag to pan. Drop files to replace.
            </p>
          )}
        </>
      )}
    </div>
  );
}
