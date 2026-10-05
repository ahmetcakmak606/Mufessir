import type { Metadata } from "next";
import {
  Amiri_Quran,
  Cormorant_Garamond,
  Noto_Naskh_Arabic,
  Source_Sans_3,
  Source_Serif_4,
} from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { LangProvider } from "@/context/LangContext";
import { QueryProvider } from "@/context/QueryProvider";

// Başlık: Cormorant Garamond (yalnızca büyük boyutlarda). Arayüz: Source Sans 3.
// Uzun Türkçe okuma: Source Serif 4. Ayet: Amiri Quran. Tefsir alıntıları: Noto Naskh Arabic.
const displayFace = Cormorant_Garamond({
  variable: "--font-display-face",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600"],
});

const uiFace = Source_Sans_3({
  variable: "--font-ui",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
});

const readingFace = Source_Serif_4({
  variable: "--font-reading",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600"],
});

const quranFace = Amiri_Quran({
  variable: "--font-quran",
  subsets: ["arabic"],
  weight: "400",
});

const naskhFace = Noto_Naskh_Arabic({
  variable: "--font-naskh",
  subsets: ["arabic"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "MufessirAI",
  description:
    "AI-powered Tafsir platform with traditional Islamic scholarship",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: eklentiler/gömülü tarayıcı React hidrasyonundan
    // önce <html>'e stil/öznitelik ekleyebilir; bilinen zararsız farkı
    // sessizleştirir (Next.js'in önerdiği yöntem).
    <html lang="tr" suppressHydrationWarning>
      <body
        className={`${displayFace.variable} ${uiFace.variable} ${readingFace.variable} ${quranFace.variable} ${naskhFace.variable} antialiased`}
      >
        <QueryProvider>
          <AuthProvider>
            <LangProvider>{children}</LangProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
