-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to Tafsir table
ALTER TABLE "Tafsir" ADD COLUMN "embedding" vector(1536); 