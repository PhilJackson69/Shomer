import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/tenant";

export default async function IncidentDetail({ params }: { params: { id: string }}) {
  const req = { headers: new Headers() } as any;
  const tenant = await requireOrg(req);
  const inc = tenant ? await prisma.incident.findFirst({
    where: { id: params.id, orgId: tenant.orgId },
    include: {
      assignedTo: { select: { id:true, email:true, name:true }},
      alerts: { include: { alert: { select: { id:true, title:true, risk:true, score:true, verified:true, region:true, topic:true, contentUrl:true }}}},
      notes: { include: { author: { select: { id:true, email:true, name:true }}}, orderBy: { createdAt: "desc" }, take: 50 },
    }
  }) : null;

  if (!inc) return <main className="p-6">Not found.</main>;

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{inc.title}</h1>
        <span className="text-xs rounded-lg border px-2 py-1">{inc.status} • {inc.severity}</span>
      </div>

      <section className="rounded-xl border p-4">
        <h2 className="font-semibold mb-2">Linked Alerts</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr><th className="text-left px-2">Title</th><th>Risk</th><th>Score</th><th>Verified</th><th>Region</th><th>Link</th></tr></thead>
            <tbody>
              {inc.alerts.map(a=> (
                <tr key={a.alert.id} className="border-t">
                  <td className="px-2 py-1">{a.alert.title}</td>
                  <td className="px-2">{a.alert.risk}</td>
                  <td className="px-2">{a.alert.score}</td>
                  <td className="px-2">{a.alert.verified ? "yes":"no"}</td>
                  <td className="px-2">{a.alert.region ?? "—"}</td>
                  <td className="px-2">{a.alert.contentUrl ? <a className="underline" href={a.alert.contentUrl} target="_blank">Source</a> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border p-4">
        <h2 className="font-semibold mb-2">Notes</h2>
        <form action={`/api/incidents/${inc.id}/notes`} method="post" className="flex gap-2">
          <input name="body" className="flex-1 border rounded-lg px-3 py-2" placeholder="Add a note…" />
          <button className="px-3 py-2 rounded-lg bg-black text-white">Add</button>
        </form>
        <ul className="mt-3 space-y-2">
          {inc.notes.map(n=> (
            <li key={n.id} className="text-sm"><span className="text-gray-500">{new Date(n.createdAt).toLocaleString()}</span> — {n.author?.email ?? "unknown"}: {n.body}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border p-4">
        <h2 className="font-semibold mb-2">Merge</h2>
        <form action={`/api/incidents/${inc.id}/merge`} method="post" className="flex gap-2">
          <input name="intoId" placeholder="Target incident ID" className="border rounded-lg px-3 py-2" />
          <button className="px-3 py-2 rounded-lg border">Merge</button>
        </form>
      </section>
    </main>
  );
}


