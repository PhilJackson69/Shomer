import { NextResponse } from "next/server";
import { getSessionUser, SessionUser } from "./session";

export type MinRole = "VIEWER" | "ANALYST" | "ADMIN";
const roleRank: Record<MinRole, number> = { VIEWER: 0, ANALYST: 1, ADMIN: 2 };

export function hasMinRole(userRole: MinRole, min: MinRole) {
  return roleRank[userRole] >= roleRank[min];
}

export async function requireUser(minRole: MinRole = "VIEWER") {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!hasMinRole(user.role, minRole))
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}

export function enforceOrg<T extends { orgId?: string | null }>(user: SessionUser, data: T) {
  if (!data?.orgId || data.orgId !== user.orgId) return false;
  return true;
}

/** Wrapper for route handlers: enforces login + role */
export function withAuth<
  Ctx extends Record<string, unknown>
>(handler: (user: SessionUser, ctx: Ctx) => Promise<Response>, minRole: MinRole = "VIEWER") {
  return async (req: Request, ctx: Ctx) => {
    const g = await requireUser(minRole);
    if ("error" in g) return g.error;
    return handler(g.user, ctx);
  };
}
