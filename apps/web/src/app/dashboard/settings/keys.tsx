"use client";
import useSWR from "swr";
import { apiFetch } from "@/lib/apiFetch";
import { useState } from "react";

const fetcher = (u:string)=>apiFetch(u).then(r=>r.json());

export default function ApiKeysPanel() {
  const { data, mutate } = useSWR("/api/org/api-keys", fetcher);
  const [name, setName] = useState("Integration");

  async function createKey() {
    const res = await apiFetch("/api/org/api-keys", { method: 'POST', headers: { "content-type": "application/json" }, body: JSON.stringify({ name })});
    const j = await res.json();
    if (j.key) alert(`Copy your API key now:\n\n${j.key}\n\nIt will not be shown again.`);
    mutate();
  }
  async function revoke(id:string) {
    await apiFetch(`/api/org/api-keys?id=${id}`, { method: 'DELETE', credentials: "include" }); mutate();
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input className="border rounded-lg px-3 py-2" value={name} onChange={e=>setName(e.target.value)} placeholder="Key name" />
        <button onClick={createKey} className="px-3 py-2 rounded-lg bg-black text-white">Create</button>
      </div>
      <table className="min-w-full text-sm">
        <thead><tr><th className="text-left">Name</th><th>Active</th><th>Last used</th><th></th></tr></thead>
        <tbody>
          {data?.keys?.map((k:any)=>(
            <tr key={k.id} className="border-t">
              <td>{k.name}</td><td>{k.active? "Yes":"No"}</td><td>{k.lastUsedAt ?? "—"}</td>
              <td><button onClick={()=>revoke(k.id)} className="text-xs underline">Revoke</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


