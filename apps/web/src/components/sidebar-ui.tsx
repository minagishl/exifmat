import { ui } from "../lib/ui";
import type { CSSProperties, ReactNode } from "react";

export function SidebarSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-white/10 px-1 py-[18px] first:border-t-0 first:pt-1">
      <h2 className={ui.sectionTitle}>{title}</h2>
      <div className="mt-3 flex flex-col gap-2">{children}</div>
    </section>
  );
}

export function UiSubheading({ children }: { children: ReactNode }) {
  return <p className={ui.subheading}>{children}</p>;
}

export function UiToggle({
  label,
  checked,
  disabled,
  onChange,
  title,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="text-xs leading-5 text-zinc-300">{label}</span>
      <span
        className="group relative h-[18px] w-8 shrink-0 rounded-full bg-zinc-600 transition-colors data-[on=true]:bg-blue-500"
        data-on={checked ? "true" : "false"}
        aria-hidden
      >
        <span className="absolute top-0.5 left-0.5 size-3.5 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.4)] transition-transform duration-[180ms] ease-[cubic-bezier(0.3,0.7,0.2,1)] group-data-[on=true]:translate-x-3.5" />
      </span>
    </button>
  );
}

export function UiField({
  label,
  value,
  disabled,
  wide,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  wide?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className={["flex min-w-0 flex-col gap-1.5", wide ? "col-span-2" : ""].join(" ")}>
      <span className="text-[0.6875rem] font-medium text-zinc-400">{label}</span>
      <input
        type="text"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 rounded-lg border border-white/10 bg-zinc-950 px-2.5 py-2 text-xs tabular-nums text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 enabled:hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  );
}

export function UiParam({
  label,
  value,
  min,
  max,
  step,
  disabled,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const pct = `${((value - min) / (max - min)) * 100}%`;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2 text-xs text-zinc-400">
        <span>{label}</span>
        <span className="text-xs tabular-nums text-zinc-200">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-[5px] w-full cursor-pointer appearance-none rounded-full [background:linear-gradient(to_right,var(--color-blue-500)_0%,var(--color-blue-500)_var(--range-pct),var(--color-zinc-700)_var(--range-pct),var(--color-zinc-700)_100%)] disabled:cursor-not-allowed disabled:opacity-45 [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:shadow-[0_1px_3px_rgb(0_0_0/0.45)] [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:shadow-[0_1px_3px_rgb(0_0_0/0.45)]"
        style={{ "--range-pct": pct } as CSSProperties}
      />
    </div>
  );
}
