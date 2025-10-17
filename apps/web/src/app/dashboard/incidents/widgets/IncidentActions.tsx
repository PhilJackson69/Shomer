"use client";
import { useState, useTransition } from "react";
import { apiFetch } from "@/lib/apiFetch";
import { IncidentNotesDrawer } from "../components/IncidentNotesDrawer";

async function post(url: string, body?: any) {
  const res = await apiFetch(url, { method: 'POST',
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function IncidentActions({ id, acked, onDone }: { id: string; acked: boolean; onDone?: () => void }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);

  const run = (path: string, body?: any) =>
    start(async () => {
      setErr(null);
      try {
        await post(`/api/incidents/${id}/${path}`, body);
        onDone?.();
      } catch (e: any) {
        setErr(e?.message || "Action failed");
      }
    });

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          className="px-2 py-1 rounded-lg border hover:bg-gray-50"
          disabled={pending || acked}
          onClick={() => run("ack")}
          title="Acknowledge incident"
        >
          {acked ? "Ack’d" : "Acknowledge"}
        </button>
        <button
          className="px-2 py-1 rounded-lg border hover:bg-gray-50"
          disabled={pending}
          onClick={() => run("close")}
          title="Close incident"
        >
          Close
        </button>
        <button
          className="px-2 py-1 rounded-lg border hover:bg-gray-50"
          onClick={() => setShowNote(v => !v)}
        >
          {showNote ? "Cancel" : "Add note"}
        </button>
      </div>

      {showNote && (
        <div className="space-y-2">
          <textarea
            className="w-full text-xs p-2 border rounded"
            rows={3}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Investigation notes, actions taken, references…"
          />
          <div className="flex justify-end">
            <button
              className="px-2 py-1 rounded-lg border hover:bg-gray-50"
              disabled={pending || !note.trim()}
              onClick={() => run("notes", { body: note })}
            >
              Save note
            </button>
          </div>
        </div>
      )}

      {err && <div className="text-xs text-red-600">{err}</div>}

      <button
        onClick={() => setNotesOpen(true)}
        className="px-2 py-1 rounded-lg border hover:bg-gray-50"
      >
        Notes
      </button>
      <IncidentNotesDrawer incidentId={id} open={notesOpen} onClose={() => setNotesOpen(false)} />
    </div>
  );
}


