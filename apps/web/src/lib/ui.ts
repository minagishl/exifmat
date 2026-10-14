/** Shared Tailwind class strings for UI elements used in more than one place. */
export const ui = {
  btnOutline:
    "inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 shadow-sm transition hover:border-white/20 hover:brightness-110 active:translate-y-px",
  btnIcon:
    "inline-flex items-center justify-center rounded-md p-1 text-zinc-400 transition-colors enabled:hover:bg-zinc-700 enabled:hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40",
  subheading: "mb-1.5 text-[0.6875rem] font-medium text-neutral-500",
  sectionTitle: "m-0 text-[0.8125rem] font-semibold tracking-[-0.005em] text-zinc-100",
} as const;
