"use client";

import useSWR from "swr";
import { useState } from "react";
import { apiFetch } from '@/lib/apiFetch';


const fetcher = (u: string) => apiFetch(u).then((r) => r.json());

export default function SavedSearchControls() {
  const { data: saved, mutate } = useSWR("/api/saved-searches", fetcher);
  const [saveName, setSaveName] = useState("");

  async function saveCurrent() {
    const qs = new URLSearchParams(window.location.search);
    const query = Object.fromEntries(qs.entries());
    const res = await apiFetch("/api/saved-searches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: saveName || "Search", kind: "alerts", query }),
    });
    if (res.ok) { setSaveName(""); mutate(); }
  }

  function applyQuery(q: Record<string, any> = {}) {
    const u = new URL(location.href);
    for (const k of ["risk", "region", "verified", "limit", "cursor", "sinceHours"]) {
      u.searchParams.delete(k);
    }
    Object.entries(q).forEach(([k, v]) => {
      if (v == null || v === "") u.searchParams.delete(k);
      else u.searchParams.set(k, String(v));
    });
    location.href = u.toString();
  }

  return (
    <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:gap-3 text-sm">
      <div className="flex items-center gap-2">
        <input
          className="border rounded-lg px-2 py-1"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          placeholder="Save current filters as…"
        />
        <button onClick={saveCurrent} className="px-3 py-1 rounded-lg border">
          Save
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:ml-auto">
        {(saved?.items ?? []).map((s: any) => (
          <button
            key={s.id}
            onClick={() => applyQuery(s.query || {})}
            className="px-2 py-1 rounded-lg border"
            title={new Date(s.updatedAt).toLocaleString()}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}


