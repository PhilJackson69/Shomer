-- CreateTable
CREATE TABLE IF NOT EXISTS "OrganizationApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "label" TEXT,
    "hash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    "lastUsedAt" DATETIME,
    CONSTRAINT "OrganizationApiKey_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrganizationApiKey_orgId_idx" ON "OrganizationApiKey"("orgId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrganizationApiKey_prefix_idx" ON "OrganizationApiKey"("prefix");