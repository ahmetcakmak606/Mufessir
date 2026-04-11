-- Add methodTags to Tafsir model and remove unused fields
ALTER TABLE "Tafsir" ADD COLUMN "methodTags" TEXT[] DEFAULT ARRAY['MIXED']::TEXT[];
ALTER TABLE "Tafsir" DROP COLUMN IF EXISTS "languageLevel";
ALTER TABLE "Tafsir" DROP COLUMN IF EXISTS "emotionalRatio";