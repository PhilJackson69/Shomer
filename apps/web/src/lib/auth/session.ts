import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export type SessionUser = {
  id: string;
  orgId: string;
  role: "VIEWER" | "ANALYST" | "ADMIN";
  displayName?: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  // Replace with your real session lookup (NextAuth/JWT/etc.)
  const cookie = cookies().get("session")?.value;
  if (!cookie) return null;

  const userId = await verifyAndExtractUserId(cookie); // implement in your auth layer
  if (!userId) return null;

  // Get user with their organization membership
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: {
          organization: true
        }
      }
    }
  });
  
  if (!user || !user.memberships.length) return null;
  
  // For now, use the first organization membership
  // In a multi-org setup, you'd need to determine which org context to use
  const membership = user.memberships[0];
  
  return {
    id: user.id,
    orgId: membership.orgId,
    role: membership.role as "VIEWER" | "ANALYST" | "ADMIN",
    displayName: user.name
  };
}

// Stub for example - replace with your actual auth implementation
async function verifyAndExtractUserId(_cookie: string): Promise<string | null> {
  // This should verify the session cookie and extract the user ID
  // For now, return null to indicate no valid session
  // In a real implementation, you'd:
  // 1. Verify the JWT token or session
  // 2. Extract the user ID from the payload
  // 3. Return the user ID or null if invalid
  
  // Example with JWT:
  // try {
  //   const payload = jwt.verify(cookie, process.env.JWT_SECRET!);
  //   return payload.userId;
  // } catch {
  //   return null;
  // }
  
  return null;
}
