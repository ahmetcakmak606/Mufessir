-- CreateEnum
CREATE TYPE "ScholarPeriod" AS ENUM ('FOUNDATION', 'CLASSICAL_EARLY', 'CLASSICAL_MATURE', 'POST_CLASSICAL', 'MODERN', 'CONTEMPORARY');

-- CreateEnum
CREATE TYPE "TraditionAcceptance" AS ENUM ('SUNNI_MAINSTREAM', 'MUTAZILI', 'SHII_IMAMI', 'SHII_ZAYDI', 'SUFI_ISHARI', 'IBADI', 'SALAFI', 'CROSS_TRADITION');

-- CreateEnum
CREATE TYPE "SourceAccessibility" AS ENUM ('FULL_DIGITAL', 'PARTIAL_DIGITAL', 'MANUSCRIPT_ONLY', 'LOST');

-- AlterTable
ALTER TABLE "Scholar" ADD COLUMN     "bookId" TEXT,
ADD COLUMN     "corpusBreadth" INTEGER,
ADD COLUMN     "deathHijri" INTEGER,
ADD COLUMN     "detailInformation" TEXT,
ADD COLUMN     "explanation" TEXT,
ADD COLUMN     "methodologicalRigor" INTEGER,
ADD COLUMN     "mufassirAr" TEXT,
ADD COLUMN     "mufassirEn" TEXT,
ADD COLUMN     "mufassirNameLong" TEXT,
ADD COLUMN     "mufassirTr" TEXT,
ADD COLUMN     "periodCode" "ScholarPeriod",
ADD COLUMN     "scholarlyInfluence" INTEGER,
ADD COLUMN     "sourceAccessibility" "SourceAccessibility",
ADD COLUMN     "tafsirType1" TEXT,
ADD COLUMN     "tafsirType2" TEXT,
ADD COLUMN     "traditionAcceptance" "TraditionAcceptance"[] DEFAULT ARRAY[]::"TraditionAcceptance"[],
ALTER COLUMN "century" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "SearchResult" ADD COLUMN     "citations" JSONB,
ADD COLUMN     "confidenceScore" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "ScholarReference" (
    "id" TEXT NOT NULL,
    "scholarId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceTitle" TEXT NOT NULL,
    "volume" TEXT,
    "page" TEXT,
    "edition" TEXT,
    "citationText" TEXT,
    "provenance" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScholarReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScholarReference_scholarId_idx" ON "ScholarReference"("scholarId");

-- CreateIndex
CREATE INDEX "ScholarReference_sourceType_idx" ON "ScholarReference"("sourceType");

-- CreateIndex
CREATE INDEX "Scholar_periodCode_idx" ON "Scholar"("periodCode");

-- CreateIndex
CREATE INDEX "Scholar_madhab_idx" ON "Scholar"("madhab");

-- CreateIndex
CREATE INDEX "Scholar_sourceAccessibility_idx" ON "Scholar"("sourceAccessibility");

-- AddForeignKey
ALTER TABLE "ScholarReference" ADD CONSTRAINT "ScholarReference_scholarId_fkey" FOREIGN KEY ("scholarId") REFERENCES "Scholar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
