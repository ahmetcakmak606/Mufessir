-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "openaiApiKey" TEXT,
    "dailyQuota" INTEGER NOT NULL DEFAULT 10,
    "quotaResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verse" (
    "id" TEXT NOT NULL,
    "surahNumber" INTEGER NOT NULL,
    "surahName" TEXT NOT NULL,
    "verseNumber" INTEGER NOT NULL,
    "arabicText" TEXT NOT NULL,
    "transliteration" TEXT,
    "translation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scholar" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birthYear" INTEGER,
    "deathYear" INTEGER,
    "century" INTEGER NOT NULL,
    "madhab" TEXT,
    "period" TEXT,
    "environment" TEXT,
    "originCountry" TEXT,
    "reputationScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scholar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tafsir" (
    "id" TEXT NOT NULL,
    "verseId" TEXT NOT NULL,
    "scholarId" TEXT NOT NULL,
    "tafsirText" TEXT NOT NULL,
    "tafsirType" TEXT,
    "keywords" TEXT[],
    "languageLevel" INTEGER,
    "emotionalRatio" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tafsir_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Search" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verseId" TEXT NOT NULL,
    "query" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Search_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchResult" (
    "id" TEXT NOT NULL,
    "searchId" TEXT NOT NULL,
    "tafsirId" TEXT NOT NULL,
    "aiResponse" TEXT NOT NULL,
    "similarityScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verseId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Verse_surahNumber_verseNumber_key" ON "Verse"("surahNumber", "verseNumber");

-- AddForeignKey
ALTER TABLE "Tafsir" ADD CONSTRAINT "Tafsir_verseId_fkey" FOREIGN KEY ("verseId") REFERENCES "Verse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tafsir" ADD CONSTRAINT "Tafsir_scholarId_fkey" FOREIGN KEY ("scholarId") REFERENCES "Scholar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Search" ADD CONSTRAINT "Search_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Search" ADD CONSTRAINT "Search_verseId_fkey" FOREIGN KEY ("verseId") REFERENCES "Verse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchResult" ADD CONSTRAINT "SearchResult_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "Search"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchResult" ADD CONSTRAINT "SearchResult_tafsirId_fkey" FOREIGN KEY ("tafsirId") REFERENCES "Tafsir"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_verseId_fkey" FOREIGN KEY ("verseId") REFERENCES "Verse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
