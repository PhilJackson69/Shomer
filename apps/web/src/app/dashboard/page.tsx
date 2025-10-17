"use client";
import { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import SavedSearchControls from "@/components/SavedSearchControls";
import useSWR from "swr";
import { apiFetch } from '@/lib/apiFetch';

const fetcher = (u: string) => apiFetch(u).then(r => r.json());

export default function DashboardPage() {
  const [risk, setRisk] = useState<string>("");
  const [onlyUnverified, setOnlyUnverified] = useState<boolean>(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const timer = useRef<number | null>(null);

  const key = useMemo(() => {
    const params = new URLSearchParams({ limit: "10" });
    if (risk) params.set("risk", risk);
    if (onlyUnverified) params.set("verified", "false");
    return `/api/alerts?${params.toString()}`;
  }, [risk, onlyUnverified]);

  const { data, isLoading, mutate } = useSWR(key, fetcher, { refreshInterval: 0 });
  const alerts = data?.alerts ?? [];
  const selectedIds = useMemo(() => Object.keys(selected).filter(id => selected[id]), [selected]);

  // SSE subscription for live updates
  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (!data?.type) return;
        // debounce revalidate
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => mutate(), 250);
      } catch {}
    };
    es.onerror = () => { /* let it reconnect automatically by browser */ };
    return () => { es.close(); if (timer.current) window.clearTimeout(timer.current); };
  }, [mutate]);

  function toggleAll() {
    const next: Record<string, boolean> = {};
    alerts.forEach((a: any) => { next[a.id] = true; });
    setSelected(next);
  }
  function clearSel() { setSelected({}); }

  async function bulk(path: string, body?: any) {
    const res = await apiFetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? { ids: selectedIds }) });
    if (res.ok) {
      // Show success toast
      console.log("Bulk action saved");
    } else {
      console.log("Bulk action failed");
    }
    clearSel();
    mutate();
  }

  function exportCSV() {
    const rows = alerts.map((a: any) => ({
      id: a.id, createdAt: a.createdAt, title: a.title, risk: a.risk, score: a.score, region: a.region ?? "", topic: a.topic ?? "", verified: a.verified
    }));
    const header = Object.keys(rows[0] ?? {id:"",createdAt:"",title:"",risk:"",score:"",region:"",topic:"",verified:""}).join(",");
    const csv = [header, ...rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g,'""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `alerts_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  async function act(path: string) {
    await apiFetch(path, { method: "POST" });
    mutate();
  }

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Shomer — Recent Alerts</h1>
        <a href="/dashboard/map" className="text-sm underline">Map view</a>
      </div>

      <SavedSearchControls />
      {selectedIds.length > 0 && (
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span>{selectedIds.length} selected</span>
          <button onClick={() => bulk("/api/alerts/bulk/verify", { ids: selectedIds })} className="px-3 py-1 rounded-lg bg-black text-white">Verify selected</button>
          <button onClick={() => bulk("/api/alerts/bulk/dismiss", { ids: selectedIds })} className="px-3 py-1 rounded-lg border">Dismiss selected</button>
          <button onClick={clearSel} className="text-xs underline">Clear</button>
          <button
            onClick={async () => {
              const res = await apiFetch("/api/incidents", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ title: `Incident (${selectedIds.length} alerts)`, severity: "MEDIUM", alertIds: selectedIds })
              });
              if (res.ok) { console.log("Incident opened"); clearSel(); } else console.log("Failed");
            }}
            className="px-3 py-1 rounded-lg border text-xs">
            Open Incident with selected
          </button>
        </div>
      )}
      <div className="mb-3 flex gap-2">
        <button onClick={exportCSV} className="px-3 py-1 rounded-lg border text-sm">Export CSV (client)</button>
        <a 
          href={`/api/alerts/export?${new URLSearchParams({
            ...(risk && { risk }),
            ...(onlyUnverified && { verified: "false" }),
            sinceHours: "168",
            limit: "5000"
          }).toString()}`}
          className="px-3 py-1 rounded-lg border text-sm hover:bg-gray-50"
        >
          Export CSV (server)
        </a>
      </div>
      <div className="mb-4 flex gap-3 items-center">
        <select value={risk} onChange={(e) => setRisk(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All risks</option>
          <option value="HIGH">HIGH</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="LOW">LOW</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyUnverified} onChange={(e) => setOnlyUnverified(e.target.checked)} />
          Only unverified
        </label>
      </div>
      {(risk || onlyUnverified) && (
        <div className="mb-3 text-xs rounded-lg bg-gray-50 border px-3 py-2">
          Filters active: {risk || "All risks"} {onlyUnverified ? " • Only unverified" : ""}
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <Th>
                <input type="checkbox" onChange={(e) => e.target.checked ? toggleAll() : clearSel()} />
              </Th>
              <Th>Time</Th><Th>Title</Th><Th>Risk</Th><Th>Score</Th><Th>Region</Th><Th>Topic</Th><Th>Actions</Th><Th>Link</Th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr><td className="px-4 py-4" colSpan={8}>Loading…</td></tr>
            ) : alerts.length === 0 ? (
              <tr><td className="px-4 py-4" colSpan={9}>No alerts yet. Run a scan.</td></tr>
            ) : alerts.map((a: any) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <Td>
                  <input
                    type="checkbox"
                    checked={!!selected[a.id]}
                    onChange={(e) => setSelected(s => ({ ...s, [a.id]: e.target.checked }))}
                  />
                </Td>
                <Td>{new Date(a.createdAt).toLocaleString()}</Td>
                <Td className="font-medium">{a.title}</Td>
                <Td>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    a.risk === "HIGH" ? "bg-red-100 text-red-800" :
                    a.risk === "MEDIUM" ? "bg-yellow-100 text-yellow-800" :
                    "bg-green-100 text-green-800"}`}>{a.risk}</span>
                </Td>
                <Td>{a.score}</Td>
                <Td>{a.region ?? "—"}</Td>
                <Td>{a.topic ?? "—"}</Td>
                <Td>
                  <div className="flex gap-2">
                    {!a.verified && (
                      <button
                        onClick={() => act(`/api/alerts/${a.id}/verify`)}
                        className="px-3 py-1 rounded-lg bg-black text-white text-xs hover:opacity-90">
                        Verify
                      </button>
                    )}
                    <button
                      onClick={() => act(`/api/alerts/${a.id}/dismiss`)}
                      className="px-3 py-1 rounded-lg border text-xs hover:bg-gray-50">
                      Dismiss
                    </button>
                    <button
                      onClick={async () => {
                        const res = await apiFetch("/api/incidents", {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ title: a.title?.slice(0, 80) || "Incident", summary: a.summary ?? "", severity: a.risk, alertIds: [a.id] })
                        });
                        if (res.ok) console.log("Incident opened"); else console.log("Failed");
                      }}
                      className="px-3 py-1 rounded-lg border text-xs hover:bg-gray-50">
                      Open Incident
                    </button>
                  </div>
                </Td>
                <Td>
                  {a.contentUrl ? (
                    <a className="text-blue-600 hover:underline" href={a.contentUrl} target="_blank" rel="noreferrer">Open</a>
                  ) : "—"}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex gap-3">
        <button onClick={async () => { await apiFetch("/api/scan", { method: "POST" }); mutate(); }}
          className="px-4 py-2 rounded-xl bg-black text-white hover:opacity-90">
          Run Mock Scan
        </button>
        <Link href="/api/alerts" className="px-4 py-2 rounded-xl border hover:bg-gray-50">View JSON</Link>
      </div>
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-sm ${className}`}>{children}</td>;
}


