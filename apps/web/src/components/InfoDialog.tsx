import type { Ref } from "react";
import aboutBg from "../assets/about-bg.webp";
import { ui } from "../lib/ui";

const ITEMS = [
  {
    title: "Privacy",
    body: "Photos are read and rendered entirely in your browser. Images and their EXIF data are never uploaded to a server.",
  },
  {
    title: "Terms of use",
    body: "Provided “as is”, without warranty of any kind. You are responsible for the photos you process and for having the right to use them.",
  },
  {
    title: "Trademarks",
    body: "Brand names and logos belong to their respective owners and are bundled only to identify the camera maker on your frames.",
  },
  {
    title: "License",
    body: "Open source software released under the MIT License.",
  },
] as const;

export function InfoDialog({ ref }: { ref: Ref<HTMLDialogElement> }) {
  return (
    <dialog
      ref={ref}
      aria-labelledby="info-dialog-title"
      onClick={(e) => {
        // Clicking the backdrop targets the <dialog> element itself.
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      className="m-auto w-[min(36rem,calc(100vw-2rem))] overflow-hidden outline-none rounded-2xl border border-white/10 bg-zinc-900 p-0 text-zinc-100 shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-[2px]"
    >
      <header
        style={{ backgroundImage: `url(${aboutBg})` }}
        className="flex aspect-video flex-col items-center justify-center bg-indigo-700 bg-[length:150%] bg-[position:100%_50%] px-5 text-center"
      >
        <h2
          id="info-dialog-title"
          className="max-w-[20ch] text-4xl leading-tight font-bold tracking-tight text-balance text-white"
        >
          Your photos stay in your browser
        </h2>
        <p className="mt-4 text-sm font-medium text-white/80">
          Free and open source, provided as is.
        </p>
      </header>

      <dl className="px-6 py-3 max-sm:max-h-[40vh] max-sm:overflow-y-auto">
        {ITEMS.map((item) => (
          <div key={item.title} className="grid gap-1 py-3 sm:grid-cols-[6.5rem_1fr] sm:gap-4">
            <dt className="text-xs leading-relaxed font-medium text-zinc-200">{item.title}</dt>
            <dd className="text-xs leading-relaxed text-zinc-400">{item.body}</dd>
          </div>
        ))}
      </dl>

      <footer className="flex justify-end border-t border-white/10 px-6 py-3">
        <form method="dialog">
          <button type="submit" className={`${ui.btnOutline} px-4`}>
            Close
          </button>
        </form>
      </footer>
    </dialog>
  );
}
