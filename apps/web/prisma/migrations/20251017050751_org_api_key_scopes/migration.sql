-- AlterTable
ALTER TABLE "OrganizationApiKey" ADD COLUMN "requestsPerMinute" INTEGER;
ALTER TABLE "OrganizationApiKey" ADD COLUMN "scopes" TEXT;
