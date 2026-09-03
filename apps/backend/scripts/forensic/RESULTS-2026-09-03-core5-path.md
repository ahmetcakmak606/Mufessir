# KITE forensik — Brief A: Core-5 slot/rank dağılımı, temsil-yoluna göre (§4.1)

`kite_core5_path_ranks.py` (repo kökü, read-only). Girdi yalnız commit'li artefaktlar:
`kite-results.jsonl` (63 run) + `kite-probe31-v2.jsonl` (4 âyet × 3 rep, k=95 tam havuz).
**OpenAI yok, DB yok.** Ham çıktı: `kite_core5_path_ranks.out.txt`.

Soru: Core-5 dışlanması temsil-yolundan (parent-embedding vs chunk-embedding) bağımsız mı;
chunk-yolu sistematik daha iyi rank veriyor mu?

## 0. Brief'teki hücre sayıları düzeltildi

Brief "25 hücre; 15 parent-only, 10 chunk-only" diyor. Kaynak tablodan (`RESULTS-2026-09-02.md` §1,
`kite-core5-occupancy.ts`) fiilî dağılım **18 parent-only / 7 chunk-only**'dir.

| verse_id | Ṭaberî | Zemahşerî | Râzî | Kurtubî | İbn Kesîr |
|---|:--:|:--:|:--:|:--:|:--:|
| 20-5 | P | P | P | P | P |
| 24-35 | **C** | P | **C** | **C** | P |
| 27-18 | P | P | P | P | P |
| 27-19 | P | P | P | P | P |
| 3-7 | **C** | P | **C** | **C** | **C** |

İki ayrı ızgara karıştırılmamalı: **doluluk ızgarası** 5 verse_id × 5 = 25 hücre (18 P / 7 C);
**rank ızgarası** 4 sorgu-âyeti × 5 = 20 hücre (13 P / 7 C), çünkü 27:18-19 tek sorgudur
(iki verse_id, ikisi de tamamen parent).

## 1. Tam-havuz rank (probe31-v2 k=95, kanonik rep = r1)

| âyet | müfessir | yol | rank (satır) | rank (tekil) | havuz-%'liği | skor | chars |
|---|---|:--:|--:|--:|--:|--:|--:|
| 20:5 | Kurtubî | P | 26/63 | 26/63 | 41.3% | 0.7341 | 636 |
| 20:5 | Ṭaberî | P | 28/63 | 28/63 | 44.4% | 0.7304 | 489 |
| 20:5 | Zemahşerî | P | 36/63 | 36/63 | 57.1% | 0.7099 | 1.172 |
| 20:5 | İbn Kesîr | P | 41/63 | 41/63 | 65.1% | 0.7030 | 324 |
| 20:5 | Râzî | P | 60/63 | 60/63 | 95.2% | 0.5573 | 6.545 |
| 24:35 | Zemahşerî | P | 20/79 | 20/79 | 25.3% | 0.8016 | 3.379 |
| 24:35 | Râzî | **C** | 54/79 | 54/79 | 68.4% | 0.6536 | 40.488 |
| 24:35 | Kurtubî | **C** | 56/79 | 56/79 | 70.9% | 0.6489 | 16.426 |
| 24:35 | Ṭaberî | **C** | 66/79 | 66/79 | 83.5% | 0.6127 | 22.293 |
| 24:35 | İbn Kesîr | P | 78/79 | 78/79 | 98.7% | 0.5392 | 11.110 |
| 27:18-19 | İbn Kesîr | P | 17/95 | 15/58 | 25.9% | 0.7490 | 1.881 |
| 27:18-19 | Zemahşerî | P | 24/95 | 19/58 | 32.8% | 0.7381 | 1.615 |
| 27:18-19 | Ṭaberî | P | 45/95 | 33/58 | 56.9% | 0.7091 | 918 |
| 27:18-19 | Kurtubî | P | 77/95 | 48/58 | 82.8% | 0.6676 | 3.060 |
| 27:18-19 | Râzî | P | 84/95 | 53/58 | 91.4% | 0.6618 | 2.121 |
| 3:7 | Zemahşerî | P | 12/75 | 12/75 | 16.0% | 0.7328 | 2.673 |
| 3:7 | Kurtubî | **C** | 53/75 | 53/75 | 70.7% | 0.5249 | 19.598 |
| 3:7 | Ṭaberî | **C** | 54/75 | 54/75 | 72.0% | 0.5199 | 42.379 |
| 3:7 | İbn Kesîr | **C** | 61/75 | 61/75 | 81.3% | 0.5028 | 16.392 |
| 3:7 | Râzî | **C** | 63/75 | 63/75 | 84.0% | 0.5002 | 30.974 |

- **top-10 içinde Core-5: 0/20 hücre.** En iyi Core-5 rank'ı 12/75 (Zemahşerî, 3:7, parent).
- rep-kararlılığı: 20/20 hücrede r1/r2/r3 satır-rank'ı **birebir aynı** (rank oynaması sıfır).

## 2. Rank dağılımı, yola göre (r1, 20 hücre)

| yol | n | tekil-rank (min / medyan / maks) | havuz-%'liği medyan (aralık) | chars medyan | chars↔%'lik Spearman ρ |
|---|--:|---|---|--:|--:|
| parent-only | 13 | 12 / 33.0 / 78 | 56.9% (16.0–98.7%) | 1.881 | **+0.242** |
| chunk-only | 7 | 53 / 56.0 / 66 | 72.0% (68.4–84.0%) | 22.293 | **−0.071** |

parent ranklar: 12, 15, 19, 20, 26, 28, 33, 36, 41, 48, 53, 60, 78
chunk ranklar: 53, 54, 54, 56, 61, 63, 66

**Konfound (kritik):** chunk-yolu hücreleri tam olarak *uzun şerhlerdir* (medyan 22.293 vs 1.881 chars).
Yol ile uzunluk iç içedir; iki yolun mutlak rank ortalamaları doğrudan karşılaştırılamaz.

Uzunluk-eşli tek temiz karşılaştırma (âyet-içi, 24:35 — aynı sorgu, aynı havuz):

| müfessir | yol | chars | rank |
|---|:--:|--:|--:|
| Zemahşerî | parent | 3.379 | 20/79 (25.3%) |
| **İbn Kesîr** | **parent** | **11.110** | **78/79 (98.7%)** |
| Kurtubî | chunk | 16.426 | 56/79 (70.9%) |
| Ṭaberî | chunk | 22.293 | 66/79 (83.5%) |
| **Râzî** | **chunk** | **40.488** | **54/79 (68.4%)** |

11.110 karakterlik parent-yolu şerhi (İbn Kesîr) 79'da 78'inci; 40.488 karakterlik chunk-yolu
şerhi (Râzî) 79'da 54'üncü. Chunk-yolu içinde uzunluk↔rank ilişkisi kaybolur (ρ = −0.071),
parent-yolunda pozitif kalır (ρ = +0.242; âyet-içi tekil ölçümlerde `kite-probe31-v2-analysis.txt`
ρ = 0.39–0.80). n=7 chunk hücresi; tek âyetten genelleme yapılmadı, tüm dağılım yukarıdadır.

## 3. Prompt-slot doluluğu (63 run, yalnız *admissible* fırsatlar)

Fırsat = müfessirin o koşumda preset'e göre uygun olduğu durum (allN'de havuzun tamamı).

| grup | parent-only | chunk-only | toplam |
|---|--:|--:|--:|
| core5 (M1-M3) | 108/117 (92%) | **63/63 (100%)** | 171/180 |
| allN (M4-M5) | **0/48 (0%)** | **0/42 (0%)** | **0/90** |
| extended (M6) | 24/36 (67%) | 9/9 (100%) | 33/45 |

Kaçırılan slotlar (allN dışı, hepsi **parent** yolunda):

| grup | âyet | müfessir | yol | slot |
|---|---|---|:--:|--:|
| core5 (M1-M3) | 27:18-19 | Râzî | P | 0/9 |
| extended (M6) | 20:5 | Râzî | P | 0/3 |
| extended (M6) | 24:35 | İbn Kesîr | P | 0/3 |
| extended (M6) | 27:18-19 | Râzî | P | 0/3 |
| extended (M6) | 27:18-19 | Kurtubî | P | 0/3 |

allN'de Core-5 doluluğu **her iki yolda da tam sıfır** (parent 0/48, chunk 0/42).

## 4. Alt-küme 27:18-19 (10/10 doluluk hücresi parent-only)

Havuz: 95 satır / 58 tekil müfessir (isRange → müfessir başına 2 satır).

| müfessir | yol | rank (tekil) | skor | chars |
|---|:--:|--:|--:|--:|
| İbn Kesîr | parent | 15/58 (25.9%) | 0.7490 | 1.881 |
| Zemahşerî | parent | 19/58 (32.8%) | 0.7381 | 1.615 |
| Ṭaberî | parent | 33/58 (56.9%) | 0.7091 | 918 |
| Kurtubî | parent | 48/58 (82.8%) | 0.6676 | 3.060 |
| Râzî | parent | 53/58 (91.4%) | 0.6618 | 2.121 |

- allN top-10 içinde Core-5: **0/15**. Chunk-yolu bu âyette hiç devrede değil.
- core5-preset (M1-M3) koşumlarında **Râzî 0/9 slot**: `retrieved_all` 10 satır (5 müfessir × 2 âyet),
  prompt 6 slot; mükerrer satırlar (İbn Kesîr ×2 rank 1-2, Ṭaberî ×2 rank 4-5) slotları doldurdu,
  Râzî rank 7-8'de kaldı. Preset Core-5'e kilitliyken bile bir Core-5 üyesi düştü —
  mekanizma isRange satır-çoğaltması + slice, **parent yolunda**.

## Ham bulgu özeti (yorum yapılmadı)

1. Core-5 dışlanması her iki temsil-yolunda da tam: allN'de parent 0/48, chunk 0/42; tam-havuz
   rank'larında top-10 içinde 0/20 hücre.
2. Chunk-yolu mutlak rank'ta daha iyi değil (medyan %72.0 vs %56.9) — ama chunk hücreleri
   tam olarak uzun şerhler. Uzunluk kontrol edildiğinde (24:35 âyet-içi) chunk-yolu 3.6 kat
   uzun bir metni 24 sıra yukarı taşıyor; chunk-yolu içinde uzunluk↔rank ilişkisi kayboluyor.
3. Preset Core-5'e kilitliyken bile 9/180 slot kaybı var; hepsi tek hücrede (27:18-19 × Râzî),
   nedeni isRange satır-çoğaltması, temsil-yolu değil.

---

## Düzeltme (2026-09-03, aynı gün): 27:18-19 yüzdelik paydaları

Kapı sorgusu (`kite-naml-kulli-gap.ts`) 27:18-19'un gerçek havuzunun **72 tekil müfessir**
olduğunu ölçtü; probe k=95 **satır** limiti, isRange satır-çoğaltması yüzünden yalnız 58 tekile
ulaşıyor. Bu dosyanın ilk sürümü 58'i payda olarak kullandı.

**Rank değerleri değişmedi** — dilim, skora göre tepeden alınmış bir prefikstir; dilime girmeyen
14 müfessirin tamamı dilimdekilerin altında yer alır. Değişen yalnız yüzdeliklerdir:

| müfessir | rank | eski (÷58) | **düzeltilmiş (÷72)** |
|---|--:|--:|--:|
| İbn Kesîr | 15 | 25.9% | **20.8%** |
| Zemahşerî | 19 | 32.8% | **26.4%** |
| Ṭaberî | 33 | 56.9% | **45.8%** |
| Kurtubî | 48 | 82.8% | **66.7%** |
| Râzî | 53 | 91.4% | **73.6%** |

Bağlı düzeltme — §2 parent-only satırı: havuz-yüzdeliği medyanı **56.9% → 45.8%**,
chars/yüzdelik Spearman ρ **+0.242 → +0.264**. chunk-only satırı etkilenmedi (27:18-19'da
chunk-yolu hücresi yok). §1, §3 ve §4'ün rank/slot sayıları etkilenmedi.

Diğer üç âyette dilim = havuz (betik artık assert ediyor): 3:7 = 75, 20:5 = 63, 24:35 = 79.
`kite_core5_path_ranks.py` DB-ölçümlü paydaları kullanacak biçimde güncellendi; çıktı
`kite_core5_path_ranks.out.txt` yenilendi.
