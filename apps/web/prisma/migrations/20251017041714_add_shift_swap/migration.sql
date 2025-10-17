-- CreateTable
CREATE TABLE "ShiftSwap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "requestedUserId" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" DATETIME,
    "decidedBy" TEXT,
    CONSTRAINT "ShiftSwap_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShiftSwap_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "OnCall" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShiftSwap_requestedUserId_fkey" FOREIGN KEY ("requestedUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ShiftSwap_orgId_status_idx" ON "ShiftSwap"("orgId", "status");
