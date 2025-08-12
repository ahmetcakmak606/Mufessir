-- Sample data for testing the Mufessir application

-- Insert sample verses
INSERT INTO "Verse" (id, "surahNumber", "surahName", "verseNumber", "arabicText", transliteration, translation, "createdAt", "updatedAt") VALUES
('verse-1-1', 1, 'Al-Fatiha', 1, 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', 'Bismillahi r-rahmani r-rahim', 'In the name of Allah, the Most Gracious, the Most Merciful', NOW(), NOW()),
('verse-1-2', 1, 'Al-Fatiha', 2, 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ', 'Alhamdu lillahi rabbi l-alamin', 'Praise be to Allah, Lord of the worlds', NOW(), NOW()),
('verse-2-255', 2, 'Al-Baqarah', 255, 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ', 'Allahu la ilaha illa huwa l-hayyu l-qayyum', 'Allah - there is no deity except Him, the Ever-Living, the Self-Sustaining', NOW(), NOW()),
('verse-3-64', 3, 'Al-Imran', 64, 'قُلْ يَا أَهْلَ الْكِتَابِ تَعَالَوْا إِلَىٰ كَلِمَةٍ سَوَاءٍ بَيْنَنَا وَبَيْنَكُمْ', 'Qul ya ahla l-kitabi ta''alaw ila kalimatin sawa''in baynana wa baynakum', 'Say, O People of the Scripture, come to a word that is equitable between us and you', NOW(), NOW()),
('verse-112-1', 112, 'Al-Ikhlas', 1, 'قُلْ هُوَ اللَّهُ أَحَدٌ', 'Qul huwa Allahu ahad', 'Say, He is Allah, [who is] One', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert sample scholars
INSERT INTO "Scholar" (id, name, "birthYear", "deathYear", century, madhab, period, environment, "originCountry", "reputationScore", "createdAt", "updatedAt") VALUES
('scholar-tabari', 'Abu Ja''far al-Tabari', 839, 923, 9, 'Shafi''i', 'Abbasid', 'Dar al-Islam', 'Persia', 9.5, NOW(), NOW()),
('scholar-qurtubi', 'Al-Qurtubi', 1214, 1273, 13, 'Maliki', 'Almohad', 'Dar al-Islam', 'Al-Andalus', 9.2, NOW(), NOW()),
('scholar-kathir', 'Ibn Kathir', 1300, 1373, 14, 'Shafi''i', 'Mamluk', 'Dar al-Islam', 'Syria', 9.8, NOW(), NOW()),
('scholar-razi', 'Fakhr al-Din al-Razi', 1149, 1210, 12, 'Shafi''i', 'Ayyubid', 'Dar al-Islam', 'Persia', 9.3, NOW(), NOW()),
('scholar-baydawi', 'Al-Baydawi', 1226, 1286, 13, 'Shafi''i', 'Ilkhanate', 'Dar al-Islam', 'Persia', 8.9, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert sample tafsirs
INSERT INTO "Tafsir" (id, "verseId", "scholarId", "tafsirText", "tafsirType", keywords, "languageLevel", "emotionalRatio", "createdAt", "updatedAt") VALUES
('tafsir-1-1-tabari', 'verse-1-1', 'scholar-tabari', 'The opening of the Quran begins with the Basmala, which is a declaration of reliance upon Allah. Al-Tabari explains that "Bismillah" means "I begin with the name of Allah" and that ar-Rahman and ar-Rahim are two of the most beautiful names of Allah, both deriving from mercy (rahma). Rahman indicates the all-encompassing mercy of Allah for all His creation, while Rahim refers to the specific mercy reserved for the believers in the Hereafter.', 'Linguistic', ARRAY['Basmala', 'mercy', 'Rahman', 'Rahim'], 8, 0.3, NOW(), NOW()),

('tafsir-1-2-tabari', 'verse-1-2', 'scholar-tabari', 'Al-Tabari interprets "Alhamdu lillahi" as a statement of praise that belongs to Allah alone. He explains that "rabb" (Lord) signifies the One who creates, sustains, and manages all affairs. "Al-alamin" (the worlds) refers to all that exists besides Allah - the world of humans, jinn, angels, and all other creatures. This verse establishes Allah''s absolute sovereignty over all creation.', 'Linguistic', ARRAY['praise', 'lordship', 'creation', 'sovereignty'], 8, 0.4, NOW(), NOW()),

('tafsir-2-255-kathir', 'verse-2-255', 'scholar-kathir', 'This is the famous Ayat al-Kursi (Verse of the Throne), which Ibn Kathir describes as the greatest verse in the Quran. The verse begins with a emphatic declaration of monotheism: "Allah - there is no deity except Him." The attributes mentioned - Al-Hayy (the Ever-Living) and Al-Qayyum (the Self-Sustaining) - encompass all of Allah''s perfect attributes. Ibn Kathir explains that Allah''s knowledge encompasses all things, His throne extends over the heavens and earth, and maintaining them is not burdensome for Him.', 'Doctrinal', ARRAY['monotheism', 'throne', 'knowledge', 'sovereignty'], 9, 0.2, NOW(), NOW()),

('tafsir-3-64-razi', 'verse-3-64', 'scholar-razi', 'Fakhr al-Din al-Razi explains this verse as a call to dialogue and common ground between Muslims and the People of the Book (Christians and Jews). The "word that is equitable" (kalimatin sawa''in) refers to the fundamental principle of monotheism - worshipping Allah alone without partners. Al-Razi emphasizes that this verse demonstrates Islam''s approach of seeking common ground while maintaining theological distinctiveness.', 'Theological', ARRAY['dialogue', 'monotheism', 'People of the Book', 'common ground'], 9, 0.5, NOW(), NOW()),

('tafsir-112-1-qurtubi', 'verse-112-1', 'scholar-qurtubi', 'Al-Qurtubi explains that Surah Al-Ikhlas, though brief, encapsulates the essence of monotheistic belief. The command "Qul" (Say) emphasizes the prophetic proclamation of this fundamental truth. "Huwa" (He) serves as a pronoun of emphasis, while "Allah" is the proper name of God. "Ahad" (One) signifies absolute unity and uniqueness, indicating that Allah is one in His essence, attributes, and actions, with no partners or equals.', 'Theological', ARRAY['monotheism', 'unity', 'uniqueness', 'essence'], 8, 0.3, NOW(), NOW()),

('tafsir-1-1-baydawi', 'verse-1-1', 'scholar-baydawi', 'Al-Baydawi provides a philosophical approach to the Basmala, explaining that beginning with Allah''s name indicates seeking blessing and success in all endeavors. He discusses the grammatical structure, noting that the preposition "bi" (with) implies instrumentality - we accomplish things through Allah''s name. The dual mention of mercy (Rahman, Rahim) emphasizes that Allah''s mercy is the predominant attribute in His dealings with creation.', 'Philosophical', ARRAY['blessing', 'grammar', 'instrumentality', 'mercy'], 9, 0.4, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Note: The embedding column will be populated by the embedding script
-- For now, we leave it as NULL and the similarity search will fall back to sample data 