import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { externalFetch as fetch } from '@/lib/external-fetch';


function signBody(secret: string, body: string) {
  return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
}

export async function deliverWebhook(orgId: string, type: string, payload: unknown) {
  const hooks = await prisma.webhook.findMany({
    where: { orgId, active: true, events: { contains: type } },
    select: { id: true, url: true, secret: true }
  });
  if (hooks.length === 0) return;

  const body = JSON.stringify({ type, ts: Date.now(), payload });

  for (const h of hooks) {
    let attempt = 0, ok = false, lastErr = "";
    while (attempt < 3 && !ok) {
      attempt++;
      try {
        const res = await externalFetch(h.url, {
          method: "POST",
          headers: { "content-type": "application/json", "X-Shomer-Event": type, "X-Shomer-Signature": signBody(h.secret, body) },
          body,
        });
        ok = res.ok;
        await prisma.webhookDelivery.create({
          data: { orgId, webhookId: h.id, event: type, payload: JSON.parse(body), attempt, status: res.status, dead: !ok && attempt >= 3, error: ok ? null : await res.text().catch(()=>null) }
        });
      } catch (e: any) {
        lastErr = String(e?.message ?? e);
        await prisma.webhookDelivery.create({
          data: { orgId, webhookId: h.id, event: type, payload: JSON.parse(body), attempt, status: 0, dead: attempt >= 3, error: lastErr }
        });
      }
      if (!ok) await new Promise(r => setTimeout(r, attempt * 500));
    }
  }
}


