import { NextResponse } from "next/server";
import { z } from "zod";
import { requireModerator } from "@/lib/rbac";

const SearchParams = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  action: z.string().optional(),
  userId: z.string().optional(),
  resourceType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional()
});

export async function GET(req: Request) {
  const auth = await requireModerator();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 403 });

  try {
    const url = new URL(req.url);
    const searchParams = SearchParams.safeParse({
      page: url.searchParams.get("page"),
      limit: url.searchParams.get("limit"),
      action: url.searchParams.get("action"),
      userId: url.searchParams.get("userId"),
      resourceType: url.searchParams.get("resourceType"),
      startDate: url.searchParams.get("startDate"),
      endDate: url.searchParams.get("endDate")
    });

    if (!searchParams.success) {
      return NextResponse.json({ error: "Invalid search parameters" }, { status: 400 });
    }

    const { page = "1", limit = "50" } = searchParams.data;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // Mock audit log data - replace with actual database queries
    const auditLogs = [
      {
        id: "audit_001",
        action: "alert.verify",
        resourceType: "alert",
        resourceId: "alert_123",
        userId: "user_001",
        userName: "John Moderator",
        details: {
          alertId: "alert_123",
          severity: "high",
          previousStatus: "new",
          newStatus: "verified"
        },
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30 minutes ago
      },
      {
        id: "audit_002",
        action: "alert.dismiss",
        resourceType: "alert",
        resourceId: "alert_124",
        userId: "user_002",
        userName: "Jane Admin",
        details: {
          alertId: "alert_124",
          reason: "False alarm",
          previousStatus: "new",
          newStatus: "dismissed"
        },
        ipAddress: "192.168.1.101",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
      },
      {
        id: "audit_003",
        action: "alert.create",
        resourceType: "alert",
        resourceId: "alert_125",
        userId: "system",
        userName: "AI System",
        details: {
          alertId: "alert_125",
          source: "Reddit - r/localnews",
          severity: "medium",
          confidence: 0.85,
          riskFactors: ["Threat language detected", "Urgency indicators"]
        },
        ipAddress: "127.0.0.1",
        userAgent: "Shomer-Ingestion/1.0",
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() // 4 hours ago
      },
      {
        id: "audit_004",
        action: "user.login",
        resourceType: "user",
        resourceId: "user_001",
        userId: "user_001",
        userName: "John Moderator",
        details: {
          loginMethod: "password",
          sessionId: "session_abc123"
        },
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() // 6 hours ago
      },
      {
        id: "audit_005",
        action: "tag.assign",
        resourceType: "alert",
        resourceId: "alert_123",
        userId: "user_001",
        userName: "John Moderator",
        details: {
          alertId: "alert_123",
          tagId: "tag_004",
          tagName: "Weapon Mention"
        },
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString() // 8 hours ago
      }
    ];

    // Apply filters if provided
    let filteredLogs = auditLogs;

    if (searchParams.data.action) {
      filteredLogs = filteredLogs.filter(log => 
        log.action.includes(searchParams.data.action!)
      );
    }

    if (searchParams.data.userId) {
      filteredLogs = filteredLogs.filter(log => 
        log.userId === searchParams.data.userId
      );
    }

    if (searchParams.data.resourceType) {
      filteredLogs = filteredLogs.filter(log => 
        log.resourceType === searchParams.data.resourceType
      );
    }

    if (searchParams.data.startDate) {
      const startDate = new Date(searchParams.data.startDate);
      filteredLogs = filteredLogs.filter(log => 
        new Date(log.timestamp) >= startDate
      );
    }

    if (searchParams.data.endDate) {
      const endDate = new Date(searchParams.data.endDate);
      filteredLogs = filteredLogs.filter(log => 
        new Date(log.timestamp) <= endDate
      );
    }

    // Apply pagination
    const total = filteredLogs.length;
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

    return NextResponse.json({
      auditLogs: paginatedLogs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
