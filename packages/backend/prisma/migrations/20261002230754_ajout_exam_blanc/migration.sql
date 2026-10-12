-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "gradePeriodId" TEXT;

-- CreateTable
CREATE TABLE "MockExam" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockExamEpreuve" (
    "id" TEXT NOT NULL,
    "mockExamId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "coefficient" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 20.0,
    "dateEpreuve" TIMESTAMP(3),

    CONSTRAINT "MockExamEpreuve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockExamGrade" (
    "id" TEXT NOT NULL,
    "epreuveId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "isAbsent" BOOLEAN NOT NULL DEFAULT false,
    "absenceReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockExamGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockExamResult" (
    "id" TEXT NOT NULL,
    "mockExamId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "totalPoints" DOUBLE PRECISION NOT NULL,
    "totalCoefs" DOUBLE PRECISION NOT NULL,
    "average" DOUBLE PRECISION NOT NULL,
    "rank" INTEGER,
    "decision" TEXT NOT NULL,
    "mention" TEXT,

    CONSTRAINT "MockExamResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockExamDeliberation" (
    "id" TEXT NOT NULL,
    "mockExamId" TEXT NOT NULL,
    "juryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "presidentJury" TEXT,
    "observations" TEXT,

    CONSTRAINT "MockExamDeliberation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MockExam_centerId_classeId_academicYearId_idx" ON "MockExam"("centerId", "classeId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "MockExamEpreuve_mockExamId_subjectId_key" ON "MockExamEpreuve"("mockExamId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "MockExamGrade_epreuveId_studentId_key" ON "MockExamGrade"("epreuveId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "MockExamResult_mockExamId_studentId_key" ON "MockExamResult"("mockExamId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "MockExamDeliberation_mockExamId_key" ON "MockExamDeliberation"("mockExamId");

-- CreateIndex
CREATE INDEX "Document_centerId_studentId_type_gradePeriodId_idx" ON "Document"("centerId", "studentId", "type", "gradePeriodId");

-- AddForeignKey
ALTER TABLE "MockExam" ADD CONSTRAINT "MockExam_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExam" ADD CONSTRAINT "MockExam_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExam" ADD CONSTRAINT "MockExam_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExamEpreuve" ADD CONSTRAINT "MockExamEpreuve_mockExamId_fkey" FOREIGN KEY ("mockExamId") REFERENCES "MockExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExamEpreuve" ADD CONSTRAINT "MockExamEpreuve_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExamGrade" ADD CONSTRAINT "MockExamGrade_epreuveId_fkey" FOREIGN KEY ("epreuveId") REFERENCES "MockExamEpreuve"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExamGrade" ADD CONSTRAINT "MockExamGrade_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExamResult" ADD CONSTRAINT "MockExamResult_mockExamId_fkey" FOREIGN KEY ("mockExamId") REFERENCES "MockExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExamResult" ADD CONSTRAINT "MockExamResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExamDeliberation" ADD CONSTRAINT "MockExamDeliberation_mockExamId_fkey" FOREIGN KEY ("mockExamId") REFERENCES "MockExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
