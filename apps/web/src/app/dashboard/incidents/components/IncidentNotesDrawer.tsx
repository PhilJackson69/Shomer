"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";
import { apiFetch } from '@/lib/apiFetch';


type Note = { id: string; body: string; createdAt: string; author?: string | null };
export function IncidentNotesDrawer({
  incidentId,
  open,
  onClose,
}: { incidentId: string; open: boolean; onClose: () => void }) {
  const [items, setItems] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const firstLoad = useRef(true);

  const fetchNotes = useCallback(async (next?: string | null) => {
    setLoading(true);
    const url = new URL(`/api/incidents/${incidentId}/notes`, window.location.origin);
    if (next) url.searchParams.set("cursor", next);
    url.searchParams.set("limit", "20");
    const res = await apiFetch(url.toString(), { cache: "no-store" });
    const data = await res.json();
    setItems((prev) => [...prev, ...data.items]);
    setCursor(data.nextCursor ?? null);
    setLoading(false);
  }, [incidentId]);

  useEffect(() => {
    if (open && firstLoad.current) {
      firstLoad.current = false;
      fetchNotes(null);
    }
  }, [open, fetchNotes]);

  const grouped = useMemo(() => {
    const byDay: Record<string, Note[]> = {};
    for (const n of items) {
      const d = new Date(n.createdAt);
      const key = d.toLocaleDateString();
      (byDay[key] ??= []).push(n);
    }
    return byDay;
  }, [items]);

  return (
    <div
      className={`fixed inset-0 z-50 transition ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <aside
        className={`absolute right-0 top-0 h-full w-full max-w-md bg-white dark:bg-zinc-900 shadow-xl
                    transform transition-transform ${open ? "translate-x-0" : "translate-x-full"} flex flex-col`}
        role="dialog" aria-modal="true" aria-labelledby="notes-title"
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 id="notes-title" className="text-lg font-semibold">Incident Notes</h2>
          <button onClick={onClose} className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Close notes">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {Object.entries(grouped).map(([day, notes]) => (
            <div key={day}>
              <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">{day}</div>
              <ol className="space-y-3">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
                    <div className="text-sm whitespace-pre-wrap">{n.body}</div>
                    <div className="mt-2 text-xs text-zinc-500">
                      {new Date(n.createdAt).toLocaleTimeString()} {n.author ? `· ${n.author}` : ""}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}

          {!items.length && !loading && (
            <div className="text-sm text-zinc-500">No notes yet.</div>
          )}
        </div>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
          <button
            disabled={!cursor || loading}
            onClick={() => fetchNotes(cursor)}
            className="w-full px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
          >
            {cursor ? (loading ? "Loading…" : "Load older") : "No more notes"}
          </button>
        </div>
      </aside>
    </div>
  );
}


