CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.tafsir_chunks (
  id           BIGSERIAL PRIMARY KEY,
  parent_id    TEXT NOT NULL REFERENCES public.all_tafsirs(id) ON DELETE CASCADE,
  mufassir_id  INTEGER NOT NULL,
  verse_id     TEXT NOT NULL,
  chunk_index  INTEGER NOT NULL,
  commentary   TEXT NOT NULL,
  embedding    vector(1536),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_chunk UNIQUE (parent_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_tafsir_chunks_parent  ON public.tafsir_chunks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tafsir_chunks_mufassir ON public.tafsir_chunks(mufassir_id);
CREATE INDEX IF NOT EXISTS idx_tafsir_chunks_verse    ON public.tafsir_chunks(verse_id);
CREATE INDEX IF NOT EXISTS idx_tafsir_chunks_hnsw
  ON public.tafsir_chunks USING hnsw (embedding vector_cosine_ops);

ALTER TABLE public.all_tafsirs
  ADD COLUMN IF NOT EXISTS embed BOOLEAN NOT NULL DEFAULT TRUE;
