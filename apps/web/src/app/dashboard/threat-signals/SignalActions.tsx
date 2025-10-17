"use client";
import { useState, useTransition } from "react";

import { apiFetch } from "@/lib/apiFetch";
async function post(url: string, body?: any) {
  const res = await apiFetch(url, { method: 'POST',
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function SignalActions({ id, disabled }: { id: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const act = (path: string, body?: any) =>
    start(async () => {
      setError(null);
      try {
        await post(`/api/threat-signals/${id}/${path}`, body);
        if (typeof window !== "undefined") window.location.reload();
      } catch (e: any) {
        setError(e?.message ?? "Action failed");
      }
    });

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => act("dismiss")}
        disabled={pending || disabled}
        className="px-2 py-1 rounded-lg border hover:bg-gray-50"
        title="Mark as false positive"
      >
        Dismiss (FP)
      </button>

      <button
        onClick={() => act("escalate", { bump: true })}
        disabled={pending || disabled}
        className="px-2 py-1 rounded-lg border hover:bg-gray-50"
        title="Confirm and bump severity"
      >
        Escalate
      </button>

      <button
        onClick={() => act("snooze")}
        disabled={pending || disabled}
        className="px-2 py-1 rounded-lg border hover:bg-gray-50"
        title="Hide alerts for 24 hours"
      >
        Snooze 24h
      </button>

      {error && <span className="text-red-600 text-sm">{error}</span>}
    </div>
  );
}


