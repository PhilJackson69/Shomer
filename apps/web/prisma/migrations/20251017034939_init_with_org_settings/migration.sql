-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "passwordHash" TEXT
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "kind" TEXT NOT NULL,
    "externalId" TEXT,
    "url" TEXT,
    "region" TEXT,
    "topic" TEXT,
    "orgId" TEXT,
    CONSTRAINT "Source_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "contentUrl" TEXT,
    "risk" TEXT NOT NULL DEFAULT 'LOW',
    "score" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "region" TEXT,
    "topic" TEXT,
    "sourceId" TEXT,
    "reporterId" TEXT,
    "hash" TEXT,
    "dismissedAt" DATETIME,
    "lat" REAL,
    "lng" REAL,
    "orgId" TEXT NOT NULL,
    CONSTRAINT "Alert_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Alert_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Alert_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shareToken" TEXT
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Membership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "lastUsedAt" DATETIME,
    "orgId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ApiKey_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Webhook_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orgId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorKind" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "alertId" TEXT,
    "meta" TEXT
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "orgId" TEXT NOT NULL,
    "webhookId" TEXT,
    "event" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" INTEGER NOT NULL,
    "error" TEXT,
    "dead" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "OnCall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "region" TEXT,
    "userId" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    CONSTRAINT "OnCall_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OnCall_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OnCallAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "oldData" TEXT,
    "newData" TEXT,
    CONSTRAINT "OnCallAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OnCallAudit_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "summary" TEXT,
    "slackChannel" TEXT,
    "slackThreadTs" TEXT,
    "openedById" TEXT,
    "assignedToId" TEXT,
    "parentId" TEXT,
    CONSTRAINT "Incident_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Incident_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Incident_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Incident_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Incident" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IncidentNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orgId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    CONSTRAINT "IncidentNote_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IncidentNote_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IncidentNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IncidentAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orgId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    CONSTRAINT "IncidentAssignment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IncidentAssignment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IncidentAssignment_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlertIncident" (
    "alertId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("alertId", "incidentId"),
    CONSTRAINT "AlertIncident_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AlertIncident_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "alertThreshold" INTEGER NOT NULL DEFAULT 65,
    "slackMinLevel" TEXT NOT NULL DEFAULT 'HIGH'
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "orgId" TEXT NOT NULL,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'alerts',
    "query" TEXT NOT NULL,
    CONSTRAINT "SavedSearch_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SavedSearch_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrganizationSetting" (
    "orgId" TEXT NOT NULL PRIMARY KEY,
    "preferredTimezone" TEXT NOT NULL DEFAULT 'UTC',
    "displayName" TEXT,
    "showRegion" BOOLEAN NOT NULL DEFAULT true,
    "timeFormat" TEXT NOT NULL DEFAULT '24h',
    CONSTRAINT "OrganizationSetting_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Source_externalId_key" ON "Source"("externalId");

-- CreateIndex
CREATE INDEX "Source_kind_idx" ON "Source"("kind");

-- CreateIndex
CREATE INDEX "Source_region_idx" ON "Source"("region");

-- CreateIndex
CREATE INDEX "Source_orgId_idx" ON "Source"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Alert_hash_key" ON "Alert"("hash");

-- CreateIndex
CREATE INDEX "Alert_risk_score_idx" ON "Alert"("risk", "score");

-- CreateIndex
CREATE INDEX "Alert_createdAt_idx" ON "Alert"("createdAt");

-- CreateIndex
CREATE INDEX "Alert_region_idx" ON "Alert"("region");

-- CreateIndex
CREATE INDEX "Alert_verified_dismissedAt_createdAt_idx" ON "Alert"("verified", "dismissedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Alert_lat_lng_idx" ON "Alert"("lat", "lng");

-- CreateIndex
CREATE INDEX "Alert_orgId_createdAt_idx" ON "Alert"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_name_key" ON "Organization"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_shareToken_key" ON "Organization"("shareToken");

-- CreateIndex
CREATE INDEX "Organization_slug_idx" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_shareToken_idx" ON "Organization"("shareToken");

-- CreateIndex
CREATE INDEX "Membership_orgId_role_idx" ON "Membership"("orgId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_orgId_key" ON "Membership"("userId", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_orgId_active_idx" ON "ApiKey"("orgId", "active");

-- CreateIndex
CREATE INDEX "AuditLog_orgId_createdAt_idx" ON "AuditLog"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_alertId_createdAt_idx" ON "AuditLog"("alertId", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_orgId_createdAt_idx" ON "WebhookDelivery"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_webhookId_createdAt_idx" ON "WebhookDelivery"("webhookId", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_dead_idx" ON "WebhookDelivery"("dead");

-- CreateIndex
CREATE INDEX "OnCall_orgId_region_startsAt_endsAt_idx" ON "OnCall"("orgId", "region", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "OnCallAudit_orgId_createdAt_idx" ON "OnCallAudit"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "OnCallAudit_shiftId_createdAt_idx" ON "OnCallAudit"("shiftId", "createdAt");

-- CreateIndex
CREATE INDEX "Incident_orgId_status_updatedAt_idx" ON "Incident"("orgId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Incident_assignedToId_status_idx" ON "Incident"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "AlertIncident_incidentId_idx" ON "AlertIncident"("incidentId");

-- CreateIndex
CREATE INDEX "SavedSearch_orgId_kind_updatedAt_idx" ON "SavedSearch"("orgId", "kind", "updatedAt");
