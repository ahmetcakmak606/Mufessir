-- Create AcademicSnapshot table
CREATE TABLE "AcademicSnapshot" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "verseId" TEXT NOT NULL,
    "queryText" TEXT NOT NULL,
    "corpusVersion" TEXT NOT NULL,
    "embeddingModel" TEXT NOT NULL,
    "llmModel" TEXT NOT NULL,
    "promptHash" TEXT,
    "aiResponse" TEXT,
    "arabicTafsir" TEXT,
    "turkishTafsir" TEXT,
    "retrievedSources" JSONB,
    "confidence" DOUBLE PRECISION,
    "provenance" TEXT,
    "citations" JSONB,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "citationKey" TEXT,
    "searchId" TEXT,
    CONSTRAINT "AcademicSnapshot_pkey" PRIMARY KEY ("id")
);

-- Create index for faster lookups
CREATE INDEX "AcademicSnapshot_searchId_idx" ON "AcademicSnapshot" ("searchId");
CREATE INDEX "AcademicSnapshot_verseId_idx" ON "AcademicSnapshot" ("verseId");
CREATE INDEX "AcademicSnapshot_citationKey_idx" ON "AcademicSnapshot" ("citationKey"");