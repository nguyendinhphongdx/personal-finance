-- CreateTable: RoomAssignment (historical tenant<->room assignment)
CREATE TABLE "RoomAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "moveInDate" TIMESTAMP(3) NOT NULL,
    "moveOutDate" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomAssignment_tenantId_idx" ON "RoomAssignment"("tenantId");
CREATE INDEX "RoomAssignment_roomId_idx" ON "RoomAssignment"("roomId");
CREATE INDEX "RoomAssignment_roomId_moveOutDate_idx" ON "RoomAssignment"("roomId", "moveOutDate");
CREATE INDEX "RoomAssignment_userId_idx" ON "RoomAssignment"("userId");

-- CreateIndex: enforce at most one active (moveOutDate IS NULL) assignment per tenant
CREATE UNIQUE INDEX "RoomAssignment_tenantId_active_key" ON "RoomAssignment"("tenantId") WHERE "moveOutDate" IS NULL;

-- AddForeignKey
ALTER TABLE "RoomAssignment" ADD CONSTRAINT "RoomAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomAssignment" ADD CONSTRAINT "RoomAssignment_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one RoomAssignment per existing Tenant, carrying over roomId/moveInDate/moveOutDate
INSERT INTO "RoomAssignment" (id, "tenantId", "roomId", "moveInDate", "moveOutDate", "userId", "createdAt")
SELECT concat('cra', md5(random()::text || clock_timestamp()::text)), id, "roomId", "moveInDate", "moveOutDate", "userId", "createdAt"
FROM "Tenant";

-- AlterTable: add propertyId to Tenant (tenant now belongs to a Property, not a fixed Room)
ALTER TABLE "Tenant" ADD COLUMN "propertyId" TEXT;

-- Backfill propertyId from the Room the tenant used to belong to
UPDATE "Tenant" t
SET "propertyId" = r."propertyId"
FROM "Room" r
WHERE r.id = t."roomId";

-- Enforce NOT NULL now that backfill is complete
ALTER TABLE "Tenant" ALTER COLUMN "propertyId" SET NOT NULL;

-- DropForeignKey / DropIndex: remove the old fixed roomId relation from Tenant
ALTER TABLE "Tenant" DROP CONSTRAINT "Tenant_roomId_fkey";
DROP INDEX "Tenant_roomId_idx";

-- AlterTable: drop the columns that moved to RoomAssignment
ALTER TABLE "Tenant" DROP COLUMN "roomId";
ALTER TABLE "Tenant" DROP COLUMN "moveInDate";
ALTER TABLE "Tenant" DROP COLUMN "moveOutDate";

-- CreateIndex / AddForeignKey for the new Tenant.propertyId relation
CREATE INDEX "Tenant_propertyId_idx" ON "Tenant"("propertyId");
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
