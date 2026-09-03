# KITE run-time bridge — kayıtlı similarityScore yeniden üretimi (2026-09-03)

`kite-runtime-bridge.ts` (read-only DB; OpenAI embedding çağrısı yapar). Soru: kayıtlı erişim skorunu bugünkü belge vektörü + yeniden gömülen sorgu ile üretebiliyor muyuz? Üretiliyorsa o satır için belge vektörü koşumdan (06-22) beri değişmemiş + sorgu modeli 3-large.

## Adım 0 — sorgu string'i (KODDAN)
`run-kite-harness.ts`: `Verse.arabicText` = `ayahs.ayah_text_ar`. single = ham arabicText (trim yok); range = `map(arabicText).join(" ").trim()`. Bağımsız metin yazılmadı; ayahs'tan aynı alan çekildi. v1 ayetleri: 3:7, 20:5, 24:35 (tek) + 27:18-19 (aralık, iki lafız boşlukla).

## Pozitif kontrol (v2) — GEÇTİ
Yeni v2 koşumu üretildi: `cells-v2ctrl.json` → `kite-v2ctrl.jsonl` (20:5 Core-5, queryText + sidecar tam vektör).

| scholar | kayıtlı | exact (sidecar) | \|kayıtlı−exact\| | re-embed jitter (K=5) |
|---|--|--|--|--|
| Al-Qurtubi | 0.7340919293 | 0.7340920685 | 1.39e-7 | 1.39e-7 |
| Al-Tabari | 0.7303779367 | 0.7303781452 | 2.08e-7 | 2.08e-7 |
| Al-Zamakhshari | 0.7099479431 | 0.7099484435 | 5.00e-7 | 5.00e-7 |
| Ibn Kathir | 0.7030224592 | 0.7030224749 | 1.58e-8 | 1.58e-8 |
| al-Razi | 0.5572692726 | 0.5572693363 | 6.37e-8 | 6.37e-8 |

- **exact (sidecar) ↔ kayıtlı = ≤5e-7** → AYNI sorgu vektörüyle boru hattı sayısal olarak birebir (fark = pgvector `<=>` ↔ JS cosSim tabanı). Belge vektörü v2 koşumundan beri değişmemiş + pipeline deterministik. **Kontrol geçti → v1 sonucuna bakılabilir.**
- **Tolerance = 2 × max re-embed jitter.** ÖNEMLİ: OpenAI sorgu-embedding'i **process-içi tutarlı, çağrılar-arası değişken**. Bu process'te K=5 deneme birebir aynı (jitter 5e-7 → TOL 1.001e-6); ayrı bir process çağrısında jitter 1.39e-3 (→ TOL 2.78e-3) gözlendi. Yani sabit mikro-tolerance yazı-tura; bunu açıkça beyan ediyoruz.

## v1 köprü — n = 63 bütün-satır (chars uyuşmazlığı 0; 7 chunk'lı satır kapsam dışı)

Sağlam (tolerance'tan bağımsız) istatistik:
- **max fark = 2.343e-3** (satır: Sayyid Qutb, 27:18-19, n_run=1).
- **fark ≥ 0.05 (belge-vektörü-değişimi ölçeği) : 0/63.** Hiçbir bütün-satırda doc-vektör değişimi yok (model değişimi O(0.1–0.9) verirdi; krş. model-kimliği 3-small cos 0.01–0.08).
- **fark ≤ 1e-3 : 60/63.**
- **fark ≤ (satırın 06-22 v1_spread'i + TOL) : 62/63** — bugünkü repro, o satırın koşum-günü run-to-run bandına düşüyor (tek istisna Sayyid Qutb: n_run=1, spread=0 → bant tanımsız; farkı 2.3e-3 saf sorgu jitter'ı).
- Sabit mikro-tolerance'ta m/n: bu process 12/63 (TOL 1e-6); jitter yakalayan process 63/63 (TOL 2.78e-3). Fark tümüyle sorgu-embedding nondeterminizmi (≤2.3e-3), doc tarafı değil.

Temsili satırlar (kayıtlı_ort · repro · fark · 06-22 v1_spread):
- 20:5 Al-Zamakhshari: 0.70994708 · 0.70994844 · 1.4e-6 · 2.1e-6
- 20:5 Al-Tabari: 0.73036039 · 0.73037815 · 1.8e-5 · 4.2e-5
- 3:7 Al-Zamakhshari: 0.73258958 · 0.73277631 · 1.9e-4 · 8.4e-4
- 24:35 Al-Wahidi: 0.88344824 · 0.88335230 · 9.6e-5 · 2.6e-4
- 27:18-19 Al-Tabari(1704): 0.70624045 · 0.70623391 · 6.5e-6 · 2.7e-5

## 24:35 / İbn Kesîr (bütün-satır aykırı) — ayrı
| chars | kayıtlı_ort | repro | fark | 06-22 v1_spread | drift? |
|--|--|--|--|--|--|
| 11110 | 0.53862804 | 0.53921527 | 5.87e-4 | 1.76e-3 | HAYIR (0.05 altı) |

Köprü bu satırı da üretiyor (fark 5.87e-4, kendi 06-22 bandı içinde) → **belge vektörü 06-22'den beri STABİL.** Bu, model-kimliği testindeki cos_3large=0.614 aykırısıyla çelişmez: köprü V'nin *stabilitesini* ölçer (değişmemiş); model-kimliği V'nin *bugünkü commentary'nin 3-large gömümüne eşitliğini* ölçer (değil). Yani V sabit ama = bugünkü metnin tazesi değil → metin/versiyon farkı; ayrı bir byte/normalizasyon sondasına bırakılır (bu köprünün kapsamı değil).

## Sınırlar (beyan)
- Chunk'lı satırlar köprülenmedi: DISTINCT ON hangi chunk'ın kazandığını kaydetmiyor (7 satır kapsam dışı).
- Tolerance OpenAI sorgu nondeterminizmine bağlı; bu yüzden sağlam sonuç mikro-tolerance m/n değil, "0/63 doc-değişim ölçeği + 62/63 kendi run bandı"dır.
