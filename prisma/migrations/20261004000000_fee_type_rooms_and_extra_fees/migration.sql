-- AlterTable
ALTER TABLE "BillingItemFee" ADD COLUMN     "isExtra" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "FeeTypeRoom" (
    "feeTypeId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,

    CONSTRAINT "FeeTypeRoom_pkey" PRIMARY KEY ("feeTypeId","roomId")
);

-- CreateIndex
CREATE INDEX "FeeTypeRoom_roomId_idx" ON "FeeTypeRoom"("roomId");

-- AddForeignKey
ALTER TABLE "FeeTypeRoom" ADD CONSTRAINT "FeeTypeRoom_feeTypeId_fkey" FOREIGN KEY ("feeTypeId") REFERENCES "FeeType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeTypeRoom" ADD CONSTRAINT "FeeTypeRoom_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

