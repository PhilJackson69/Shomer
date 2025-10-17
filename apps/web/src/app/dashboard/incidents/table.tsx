"use client";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { IncidentActions } from "./widgets/IncidentActions";
import { apiFetch } from '@/lib/apiFetch';


type Row = {
  id: string;
  severity: "LOW"|"MEDIUM"|"HIGH"|"CRITICAL";
  score: number;
  status: string;
  acked: boolean;
  snoozed: boolean;
  updatedAt: string;
  title: string | null;
  url: string | null;
  excerpt: string;
  indicators: string[] | null;
  rationale: string | null;
};

export default function IncidentTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const sp = useSearchParams();

  const load = useCallback(async () => {
    setErr(null);
    try {
      const url = new URL("/api/incidents", window.location.origin);
      for (const sev of sp.getAll("severity")) url.searchParams.append("severity", sev);
      const r = await apiFetch(url.toString(), { cache: "no-store" });
      const j = await r.json();
      setRows((j.items || j.open) || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load incidents");
    } finally {
      setLoading(false);
    }
  }, [sp]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="text-sm">Loading…</div>;
  if (err) return <div className="text-sm text-red-600">{err}</div>;

  return (
    <div className="border rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left py-2 px-3">Severity</th>
            <th className="text-left py-2 px-3">Title / Excerpt</th>
            <th className="text-left py-2 px-3">Indicators</th>
            <th className="text-left py-2 px-3">Updated</th>
            <th className="text-left py-2 px-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td className="py-6 px-3 text-center text-gray-500" colSpan={5}>No open incidents 🎉</td></tr>
          ) : rows.map(r => (
            <tr key={r.id} className="border-b align-top">
              <td className="py-2 px-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.severity}</span>
                  {r.acked && <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-blue-50">ACK</span>}
                  {r.snoozed && <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-yellow-50">SNOOZED</span>}
                </div>
                <div className="text-xs text-gray-500">score {r.score.toFixed(2)}</div>
              </td>
              <td className="py-2 px-3">
                <div className="font-medium">
                  {r.url ? <a className="underline" href={r.url} target="_blank" rel="noreferrer">{r.title ?? "(no title)"}</a> : (r.title ?? "(no title)")}
                </div>
                <div className="text-xs text-gray-600">{r.excerpt}</div>
                {r.rationale && <div className="text-[11px] text-gray-500 mt-0.5">reason: {r.rationale}</div>}
              </td>
              <td className="py-2 px-3 text-xs">
                {(r.indicators ?? []).map(k => (
                  <span key={k} className="mr-1 px-1.5 py-0.5 rounded-full border bg-gray-50">{k}</span>
                ))}
              </td>
              <td className="py-2 px-3 text-xs">{new Date(r.updatedAt).toLocaleString()}</td>
              <td className="py-2 px-3">
                <IncidentActions id={r.id} acked={r.acked} onDone={load} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


