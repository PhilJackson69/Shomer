"use client";
import { useEffect, useState } from "react";
import { apiFetch } from '@/lib/apiFetch';


type Metrics = {
  severity: { last7d: Record<string, number>; last30d: Record<string, number> };
  falsePositiveRate7d: number;
  avgAlertLatencySec7d: number;
  maintenanceRecent: Array<{ id: string; createdAt: string; kind: string; meta: string }>;
};

export default function AdminMetricsCard() {
  const [m, setM] = useState<Metrics | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await apiFetch("/api/admin/metrics", { cache: "no-store" });
        if (!r.ok) throw new Error(await r.text());
        const j = await r.json();
        if (alive) setM(j);
      } catch (e: any) {
        if (alive) setErr(e?.message || "Failed to load metrics");
      }
    })();
    const id = setInterval(() => {
      apiFetch("/api/admin/metrics", { cache: "no-store" })
        .then(r => r.json())
        .then(j => setM(j))
        .catch(() => {});
    }, 60000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (err) return <div className="border rounded-lg p-3 text-red-600 text-sm">{err}</div>;
  if (!m) return <div className="border rounded-lg p-3 text-sm">Loading metrics…</div>;

  const sev7 = m.severity.last7d;
  const sev30 = m.severity.last30d;
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Ops Metrics</h2>
        <div className="text-xs text-gray-500">auto-refresh 60s</div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <MetricBox label="FP rate (7d)" value={pct(m.falsePositiveRate7d)} />
        <MetricBox label="Avg alert latency" value={`${m.avgAlertLatencySec7d || 0}s`} />
        <MetricBox label="Signals (7d)" value={Object.values(sev7).reduce((a,b)=>a+b,0).toString()} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SeverityTable title="Severity (7d)" data={sev7} />
        <SeverityTable title="Severity (30d)" data={sev30} />
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Recent maintenance</h3>
        <div className="text-xs border rounded-md divide-y">
          {m.maintenanceRecent.length === 0 ? (
            <div className="p-2 text-gray-500">No maintenance logs.</div>
          ) : m.maintenanceRecent.map(row => (
            <div key={row.id} className="p-2 flex items-center justify-between">
              <div className="font-mono">{new Date(row.createdAt).toLocaleString()}</div>
              <div className="px-2 py-0.5 rounded border bg-gray-50">{row.kind}</div>
              <details className="ml-2">
                <summary className="cursor-pointer">meta</summary>
                <pre className="text-[10px] whitespace-pre-wrap max-w-[40ch]">{row.meta}</pre>
              </details>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-md p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function SeverityTable({ title, data }: { title: string; data: Record<string, number> }) {
  const rows = Object.entries(data).sort((a,b) => (a[0] > b[0] ? 1 : -1));
  return (
    <div className="border rounded-md p-3">
      <div className="text-sm font-medium mb-1">{title}</div>
      <table className="w-full text-xs">
        <tbody>
          {rows.map(([k,v]) => (
            <tr key={k}>
              <td className="py-0.5 pr-2">{k}</td>
              <td className="py-0.5 text-right font-mono">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


