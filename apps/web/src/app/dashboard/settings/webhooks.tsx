"use client";
import useSWR from "swr";
import { apiFetch } from "@/lib/apiFetch";
import { useState } from "react";
const fetcher=(u:string)=>apiFetch(u).then(r=>r.json());

export default function WebhooksPanel() {
  const { data, mutate } = useSWR("/api/org/webhooks", fetcher);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState("alert.created,alert.verified,alert.dismissed");
  const [secret, setSecret] = useState("");

  async function createHook() {
    await apiFetch("/api/org/webhooks", { method: 'POST', headers: { "content-type":"application/json" }, body: JSON.stringify({ url, events, secret })});
    setUrl(""); setSecret(""); mutate();
  }
  async function revoke(id:string) {
    await apiFetch(`/api/org/webhooks?id=${id}`, { method: 'DELETE', credentials: "include" }); mutate();
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input className="border rounded-lg px-3 py-2" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://example.com/webhook" />
        <input className="border rounded-lg px-3 py-2" value={events} onChange={e=>setEvents(e.target.value)} />
        <input className="border rounded-lg px-3 py-2" value={secret} onChange={e=>setSecret(e.target.value)} placeholder="Signing secret" />
      </div>
      <button onClick={createHook} className="px-3 py-2 rounded-lg bg-black text-white">Add Webhook</button>
      <table className="min-w-full text-sm">
        <thead><tr><th className="text-left">URL</th><th>Events</th><th>Active</th><th></th></tr></thead>
        <tbody>
          {data?.webhooks?.map((w:any)=>(
            <tr key={w.id} className="border-t">
              <td>{w.url}</td><td>{w.events}</td><td>{w.active? "Yes":"No"}</td>
              <td><button onClick={()=>revoke(w.id)} className="text-xs underline">Disable</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


