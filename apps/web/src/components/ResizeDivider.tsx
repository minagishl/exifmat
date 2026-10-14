import { useRef, type PointerEvent as ReactPointerEvent } from "react";

const SIDEBAR_MIN = 260;

export const DEFAULT_SIDEBAR_WIDTH = 520;

/** The sidebar may take up to half of the viewport. */
function maxSidebarWidth(): number {
  return Math.max(SIDEBAR_MIN, Math.floor(window.innerWidth / 2));
}

export function clampSidebarWidth(width: number): number {
  return Math.max(SIDEBAR_MIN, Math.min(maxSidebarWidth(), width));
}

interface ResizeDividerProps {
  sidebarWidth: number;
  onWidthChange: (width: number) => void;
}

export function ResizeDivider({ sidebarWidth, onWidthChange }: ResizeDividerProps) {
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const endDrag = (target: HTMLElement, pointerId: number) => {
    dragRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    try {
      target.releasePointerCapture(pointerId);
    } catch {
      /* already released */
    }
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startWidth: sidebarWidth };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const { startX, startWidth } = dragRef.current;
    onWidthChange(clampSidebarWidth(startWidth - (e.clientX - startX)));
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    endDrag(e.currentTarget, e.pointerId);
  };

  const onPointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    endDrag(e.currentTarget, e.pointerId);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuenow={sidebarWidth}
      aria-valuemin={SIDEBAR_MIN}
      aria-valuemax={maxSidebarWidth()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      className="group relative z-30 hidden w-0 shrink-0 touch-none select-none lg:block"
    >
      <div className="absolute inset-y-0 -left-1.5 w-3 cursor-col-resize">
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/10 transition-[width,background-color] duration-150 group-hover:w-[3px] group-hover:bg-blue-500/70" />
      </div>
    </div>
  );
}
