/*
  Warnings:

  - You are about to drop the column `absenceReason` on the `MockExamGrade` table. All the data in the column will be lost.
  - You are about to drop the column `epreuveId` on the `MockExamGrade` table. All the data in the column will be lost.
  - You are about to drop the `MockExam` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MockExamDeliberation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MockExamEpreuve` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MockExamResult` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[classeMockExamSubjectId,studentId]` on the table `MockExamGrade` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `classeMockExamId` to the `MockExamGrade` table without a default value. This is not possible if the table is not empty.
  - Added the required column `classeMockExamSubjectId` to the `MockExamGrade` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "MockExam" DROP CONSTRAINT "MockExam_academicYearId_fkey";

-- DropForeignKey
ALTER TABLE "MockExam" DROP CONSTRAINT "MockExam_centerId_fkey";

-- DropForeignKey
ALTER TABLE "MockExam" DROP CONSTRAINT "MockExam_classeId_fkey";

-- DropForeignKey
ALTER TABLE "MockExamDeliberation" DROP CONSTRAINT "MockExamDeliberation_mockExamId_fkey";

-- DropForeignKey
ALTER TABLE "MockExamEpreuve" DROP CONSTRAINT "MockExamEpreuve_mockExamId_fkey";

-- DropForeignKey
ALTER TABLE "MockExamEpreuve" DROP CONSTRAINT "MockExamEpreuve_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "MockExamGrade" DROP CONSTRAINT "MockExamGrade_epreuveId_fkey";

-- DropForeignKey
ALTER TABLE "MockExamResult" DROP CONSTRAINT "MockExamResult_mockExamId_fkey";

-- DropForeignKey
ALTER TABLE "MockExamResult" DROP CONSTRAINT "MockExamResult_studentId_fkey";

-- DropIndex
DROP INDEX "MockExamGrade_epreuveId_studentId_key";

-- AlterTable
ALTER TABLE "MockExamGrade" DROP COLUMN "absenceReason",
DROP COLUMN "epreuveId",
ADD COLUMN     "absenceCode" TEXT,
ADD COLUMN     "classeMockExamId" TEXT NOT NULL,
ADD COLUMN     "classeMockExamSubjectId" TEXT NOT NULL,
ADD COLUMN     "points" DOUBLE PRECISION;

-- DropTable
DROP TABLE "MockExam";

-- DropTable
DROP TABLE "MockExamDeliberation";

-- DropTable
DROP TABLE "MockExamEpreuve";

-- DropTable
DROP TABLE "MockExamResult";

-- CreateTable
CREATE TABLE "MockSubject" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultCoefficient" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiliereMockSubject" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "filiereId" TEXT NOT NULL,
    "mockSubjectId" TEXT NOT NULL,
    "coefficient" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "order" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "FiliereMockSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockExamSession" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockExamSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClasseMockExam" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "mockExamSessionId" TEXT NOT NULL,
    "classeId" TEXT NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClasseMockExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClasseMockExamSubject" (
    "id" TEXT NOT NULL,
    "classeMockExamId" TEXT NOT NULL,
    "mockSubjectId" TEXT NOT NULL,
    "coefficient" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "order" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ClasseMockExamSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockExamSummary" (
    "id" TEXT NOT NULL,
    "classeMockExamId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "totalPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCoefs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "average" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "decision" TEXT,

    CONSTRAINT "MockExamSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MockSubject_centerId_code_key" ON "MockSubject"("centerId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "FiliereMockSubject_filiereId_mockSubjectId_key" ON "FiliereMockSubject"("filiereId", "mockSubjectId");

-- CreateIndex
CREATE INDEX "MockExamSession_centerId_academicYearId_idx" ON "MockExamSession"("centerId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "ClasseMockExam_mockExamSessionId_classeId_key" ON "ClasseMockExam"("mockExamSessionId", "classeId");

-- CreateIndex
CREATE UNIQUE INDEX "ClasseMockExamSubject_classeMockExamId_mockSubjectId_key" ON "ClasseMockExamSubject"("classeMockExamId", "mockSubjectId");

-- CreateIndex
CREATE UNIQUE INDEX "MockExamSummary_classeMockExamId_studentId_key" ON "MockExamSummary"("classeMockExamId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "MockExamGrade_classeMockExamSubjectId_studentId_key" ON "MockExamGrade"("classeMockExamSubjectId", "studentId");

-- AddForeignKey
ALTER TABLE "MockSubject" ADD CONSTRAINT "MockSubject_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiliereMockSubject" ADD CONSTRAINT "FiliereMockSubject_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiliereMockSubject" ADD CONSTRAINT "FiliereMockSubject_filiereId_fkey" FOREIGN KEY ("filiereId") REFERENCES "Filiere"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiliereMockSubject" ADD CONSTRAINT "FiliereMockSubject_mockSubjectId_fkey" FOREIGN KEY ("mockSubjectId") REFERENCES "MockSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExamSession" ADD CONSTRAINT "MockExamSession_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExamSession" ADD CONSTRAINT "MockExamSession_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClasseMockExam" ADD CONSTRAINT "ClasseMockExam_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClasseMockExam" ADD CONSTRAINT "ClasseMockExam_mockExamSessionId_fkey" FOREIGN KEY ("mockExamSessionId") REFERENCES "MockExamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClasseMockExam" ADD CONSTRAINT "ClasseMockExam_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClasseMockExamSubject" ADD CONSTRAINT "ClasseMockExamSubject_classeMockExamId_fkey" FOREIGN KEY ("classeMockExamId") REFERENCES "ClasseMockExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClasseMockExamSubject" ADD CONSTRAINT "ClasseMockExamSubject_mockSubjectId_fkey" FOREIGN KEY ("mockSubjectId") REFERENCES "MockSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExamGrade" ADD CONSTRAINT "MockExamGrade_classeMockExamId_fkey" FOREIGN KEY ("classeMockExamId") REFERENCES "ClasseMockExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExamGrade" ADD CONSTRAINT "MockExamGrade_classeMockExamSubjectId_fkey" FOREIGN KEY ("classeMockExamSubjectId") REFERENCES "ClasseMockExamSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExamSummary" ADD CONSTRAINT "MockExamSummary_classeMockExamId_fkey" FOREIGN KEY ("classeMockExamId") REFERENCES "ClasseMockExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExamSummary" ADD CONSTRAINT "MockExamSummary_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
