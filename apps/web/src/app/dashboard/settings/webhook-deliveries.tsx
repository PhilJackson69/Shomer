"use client";
import useSWR from "swr";

import { apiFetch } from "@/lib/apiFetch";
const fetcher = (u: string) => apiFetch(u).then((r) => r.json());

export default function WebhookDeliveriesPanel() {
  const { data, mutate } = useSWR("/api/org/webhooks/deliveries", fetcher);

  async function retry(id: string) {
    await apiFetch("/api/org/webhooks/deliveries", { method: 'POST',
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    mutate();
  }

  return (
    <div className="rounded-xl border overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 dark:bg-neutral-900/40">
          <tr>
            <th className="text-left px-3 py-2">Event</th>
            <th>Status</th>
            <th>Attempts</th>
            <th>Error</th>
            <th>When</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(data?.items ?? []).map((i: any) => (
            <tr key={i.id} className="border-t">
              <td className="px-3 py-2">{i.event}</td>
              <td className="px-3 py-2">{i.status}</td>
              <td className="px-3 py-2">{i.attempt}</td>
              <td className="px-3 py-2">
                <pre className="whitespace-pre-wrap text-xs max-w-[28rem]">
                  {i.error ?? "—"}
                </pre>
              </td>
              <td className="px-3 py-2">
                {new Date(i.createdAt).toLocaleString()}
              </td>
              <td className="px-3 py-2">
                <button onClick={() => retry(i.id)} className="text-xs underline">
                  Retry
                </button>
              </td>
            </tr>
          ))}
          {(!data?.items || data.items.length === 0) && (
            <tr>
              <td className="px-3 py-8 text-center text-gray-500" colSpan={6}>
                No failed deliveries.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}


