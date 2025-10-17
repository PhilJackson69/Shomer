"use server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getServerSession } from "@/lib/auth";

const Payload = z.object({
  alertThreshold: z.coerce.number().int().min(0).max(100),
  slackMinLevel: z.enum(["LOW","MEDIUM","HIGH"]),
});

export async function saveSettings(formData: FormData) {
  const session = await getServerSession();
  const role = session?.role;
  if (!session || (role !== "admin" && role !== "moderator")) {
    throw new Error("Forbidden");
  }

  const data = Payload.parse({
    alertThreshold: formData.get("alertThreshold"),
    slackMinLevel: formData.get("slackMinLevel"),
  });

  await prisma.setting.upsert({
    where: { id: "default" },
    update: data,
    create: { id: "default", ...data },
  });

  return { ok: true };
}

export async function readSettings() {
  const s = await prisma.setting.findUnique({ where: { id: "default" } });
  return s ?? { alertThreshold: 65, slackMinLevel: "HIGH" };
}
