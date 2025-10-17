"use client";

import { useEffect, useState } from "react";
import { apiFetch } from '@/lib/apiFetch';


type Health = {
  ok: boolean;
  redis: "ok" | "fail";
  queues: { raw: number; enrich: number; score: number; alert: number } | null;
  lastCollectorRun?: string | null;
  error?: string;
  heartbeats?: Record<string, "ok" | "stale" | "missing">;
  flags?: { alerts: boolean; collectors: boolean };
};

export default function HealthPill() {
  const [h, setH] = useState<Health | null>(null);

  async function load() {
    try {
      const res = await apiFetch("/api/health/threat", { cache: "no-store" });
      const data = await res.json();
      setH(data);
    } catch (e) {
      setH({ ok: false, redis: "fail", queues: null, error: "fetch failed" });
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  const ok = h?.ok && h?.redis === "ok";
  const color = ok ? "bg-green-100 border-green-300" : "bg-red-100 border-red-300";
  const label = ok ? "Healthy" : "Degraded";

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm ${color}`}>
      <span className={`h-2 w-2 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`} />
      <span className="font-medium">{label}</span>
      {h?.queues && (
        <span className="text-xs opacity-70">
          Q raw:{h.queues.raw} | en:{h.queues.enrich} | sc:{h.queues.score} | al:{h.queues.alert}
        </span>
      )}
      {h?.flags && h.flags.alerts === false && (
        <span className="text-xs opacity-70">Shadow mode</span>
      )}
      {h?.heartbeats && (
        <span className="text-xs opacity-70">
          {Object.entries(h.heartbeats).map(([w, s]) => (
            <span key={w} className="mr-2">{w}:{s}</span>
          ))}
        </span>
      )}
      {h?.lastCollectorRun && <span className="text-xs opacity-70">Last run: {new Date(h.lastCollectorRun).toLocaleString()}</span>}
    </div>
  );
}


