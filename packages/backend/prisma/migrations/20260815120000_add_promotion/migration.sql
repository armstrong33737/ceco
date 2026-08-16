-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "filiereId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "expectedEndYear" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Inscription" ADD COLUMN "promotionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_centerId_filiereId_academicYearId_key" ON "Promotion"("centerId", "filiereId", "academicYearId");

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_filiereId_fkey" FOREIGN KEY ("filiereId") REFERENCES "Filiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscription" ADD CONSTRAINT "Inscription_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;