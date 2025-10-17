import { NextRequest } from "next/server";
import { hasRedis } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // kickstart
      send({ type: "sse_ready", ts: Date.now() });

      if (hasRedis()) {
        // Redis is available, use real pub/sub
        const { getRedisSub } = await import("@/lib/redis");
        const sub = getRedisSub();
        if (sub) {
          const redisSub = sub.duplicate();
          await redisSub.connect();
          await redisSub.subscribe("shomer:events");

          // heartbeat every 20s
          const hb = setInterval(() => controller.enqueue(encoder.encode(`:hb\n\n`)), 20000);

          redisSub.on("message", (_ch, msg) => {
            try { send(JSON.parse(msg)); } catch { /* ignore */ }
          });

          // close handling
          (controller as any)._onCancel = async () => {
            clearInterval(hb);
            try { await redisSub.unsubscribe("shomer:events"); await redisSub.quit(); } catch {}
          };
        }
      } else {
        // Redis is disabled, send a message indicating this
        send({ type: "redis_disabled", message: "Redis is disabled in development mode" });
        
        // heartbeat every 20s
        const hb = setInterval(() => controller.enqueue(encoder.encode(`:hb\n\n`)), 20000);
        
        // close handling
        (controller as any)._onCancel = async () => {
          clearInterval(hb);
        };
      }
    },
    cancel() {
      const c: any = this;
      if (c._onCancel) c._onCancel();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
