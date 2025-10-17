import { withAuth } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { NextResponse } from "next/server";
import { rateLimitOr429 } from "@/lib/rate/enforce";
import { requireCsrfOr403 } from "@/lib/security/csrf";

const Body = z.object({ body: z.string().trim().min(1).max(4096) });

export const POST = withAuth(async (user, { params, request }: { params: { id: string }, request: Request }) => {
  // CSRF first
  const csrfErr = requireCsrfOr403(request);
  if (csrfErr) return csrfErr;

  // Rate limit
  const rl = await rateLimitOr429("note", user.orgId, user.id);
  if (rl) return rl;

  const id = params.id;
  const sig = await prisma.threatSignal.findUnique({
    where: { id },
    select: { id: true, orgId: true },
  });
  if (!sig || sig.orgId !== user.orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { body } = Body.parse(await request.json());

  const note = await prisma.$transaction(async (tx) => {
    const n = await tx.signalNote.create({
      data: {
        signalId: id,
        orgId: user.orgId,
        body,
        authorUserId: user.id,
      },
      select: { id: true, body: true, createdAt: true, authorUserId: true },
    });
    await tx.incidentEvent.create({
      data: {
        signalId: id,
        actorUserId: user.id,
        orgId: user.orgId,
        type: "NOTE_CREATE",
        payload: JSON.stringify({ noteId: n.id }),
      },
    });
    return n;
  });

  return NextResponse.json({ ok: true, note });
}, "ANALYST");

export const GET = withAuth(async (user, { params }: { params: { id: string } }) => {
  const id = params.id;
  
  // Verify signal belongs to org
  const sig = await prisma.threatSignal.findUnique({
    where: { id },
    select: { id: true, orgId: true },
  });
  if (!sig || sig.orgId !== user.orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const notes = await prisma.signalNote.findMany({
    where: { signalId: id, orgId: user.orgId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      body: true,
      createdAt: true,
      authorUserId: true,
      author: {
        select: {
          name: true,
          email: true
        }
      }
    }
  });

  return NextResponse.json({ notes });
}, "VIEWER");