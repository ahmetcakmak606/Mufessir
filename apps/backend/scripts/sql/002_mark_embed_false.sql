-- A2: Mark Ibn Qayyim's 7 Fatiha rows embed=false
-- Run this AFTER: the A1 schema has been applied (embed column exists).
-- Run this BEFORE: generating embeddings (Phase B).
--
-- Guard: the COUNT must equal exactly 7 before the UPDATE is applied.
-- If the count is not 7, STOP and flag for human review.
--
-- Mufassir: İbn Kayyım (mufassir_id = 63)
-- Surah: al-Fātiḥa (surah_id = 1)

-- Pre-flight check:
SELECT count(*) AS row_count
FROM public.all_tafsirs t
JOIN ayahs a ON t.verse_id = a.id
WHERE a.surah_id = 1 AND t.mufassir_id = 63;

-- If (and only if) the count above = 7, run:
-- UPDATE public.all_tafsirs t
-- SET embed = FALSE
-- FROM ayahs a
-- WHERE t.verse_id = a.id
--   AND a.surah_id = 1
--   AND t.mufassir_id = 63;
