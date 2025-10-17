"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export function SeverityFilterChips() {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();

  const selected = new Set(sp.getAll("severity"));

  function toggle(level: string) {
    const next = new URLSearchParams(sp.toString());
    const curr = new Set(next.getAll("severity"));
    if (curr.has(level)) {
      const all = next.getAll("severity").filter((v) => v !== level);
      next.delete("severity");
      for (const v of all) next.append("severity", v);
    } else {
      next.append("severity", level);
    }
    next.delete("cursor");
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {LEVELS.map((lvl) => {
        const active = selected.has(lvl);
        return (
          <button
            key={lvl}
            onClick={() => toggle(lvl)}
            className={[
              "px-3 py-1.5 rounded-full text-sm border transition",
              active
                ? "border-blue-600 bg-blue-50 dark:bg-blue-950/30"
                : "border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800",
            ].join(" ")}
            aria-pressed={active}
          >
            {lvl}
          </button>
        );
      })}
      {selected.size > 0 && (
        <button
          onClick={() => router.replace(pathname)}
          className="px-3 py-1.5 rounded-full text-sm border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          Clear
        </button>
      )}
    </div>
  );
}


