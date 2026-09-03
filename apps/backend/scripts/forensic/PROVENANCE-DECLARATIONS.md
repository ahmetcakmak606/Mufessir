# KITE — provenans beyanları (makale için)

63-run `batchId=kulliyyah-kite-2026-06-22-v1`, gerçek koşum 2026-06-22 18:55–19:02Z. Aşağıdaki beyanlar `apps/backend/scripts/forensic/` read-only sondalarına ve git geçmişine dayanır. "Kayıt yok" ifadeleri de denetim izinin parçasıdır.

## Beyan 1 — embedding modeli kimliği
Korpus embedding'leri 2026-06-21'den (`b89d7e0`) itibaren `text-embedding-3-large @ dimensions=1536` pipeline'ıyla üretildi (git ile sabit; 06-20 öncesi `3-small`). Örneklenen bütün-satırlar bunu doğruluyor: saklı vektör ↔ metnin taze 3-large gömümü cos ≈ 1.0 (5 satırdan 4'ü; 1 aykırı = 24:35/İbn Kesîr, 0.614 → metin/versiyon farkı, Beyan 3'e bkz). 3-small karşılaştırması cos 0.01–0.08 (farklı uzay). **Post-run farklı-modelle yeniden gömme kaydı yok** (git'te iz yok; `updated_at` raw-UPDATE'e kör olduğundan mutlak kanıt değil). Run-time sorgu modelinin de 3-large olduğu, kayıtlı erişim skorlarının bugünkü vektörlerle yeniden üretilmesiyle **63/63 bütün-satır durumunda doğrulandı** (bkz. Beyan 3; sabit mikro-tolerance yerine "0/63 doc-değişim ölçeği" temelinde).

## Beyan 2 — run-time korpus kapsamı
06-22 koşum anında **global** kaç satırın embedding'li olduğuna dair log/snapshot **yok** → global run-time kapsam **bilinmiyor** olarak beyan edilir. Belgelenen tek run-time kapsam kanıtı **per-verse**: `retrieved_all`, ölçülen 5 ayetin havuzlarının koşumda gömülü olduğunu gösterir. Bugünkü forensik bu 5 havuzun hâlâ tam kapsandığını (vektörsüz=0) gösteriyor. Bugünkü global kısmi doluluk (~2637/389458) bir **düşüş değil**: dağılım (surah 2-3 + deney surahları yoğun, seyrek kuyruk) tamamlanmamış ileri-yönlü kısmi koşum imzası; korpus hiç tam gömülmedi. Retrieval ayet-yerel (`verse_id` filtresi) olduğundan gömülmemiş satırlar aday havuza giremez.

## Beyan 3 — belge vektörü stabilitesi (run-time → bugün köprüsü)
Kayıtlı erişim skoru (`retrieved_all.similarityScore`) bugünkü belge vektörü + yeniden gömülen sorgu (arabicText, koddan) ile yeniden üretildi. **Bütün-satır kapsamı; chunk'lı satırlar köprülenemez (DISTINCT ON hangi chunk'ı seçtiğini kaydetmiyor) — sınır olarak beyan.**
- Pozitif kontrol (v2, queryText+sidecar bilinir): aynı sorgu vektörüyle boru hattı kayıtlı skoru ≤5e-7 farkla üretti → doğrulandı.
- v1, n=63 bütün-satır (chars uyuşmazlığı 0): **0/63 belge-vektörü-değişimi ölçeğinde (≥0.05)**; max fark 2.343e-3 = OpenAI sorgu-embedding nondeterminizmi ölçeği (06-22 kendi run-to-run spread'i ile aynı mertebe); **62/63 kendi 06-22 run bandına düşüyor**. → **Belge vektörleri 06-22'den beri değişmemiş** (63/63 bütün-satır).
- Sabit mikro-tolerance m/n oynak (12–63/63), çünkü tolerance OpenAI sorgu nondeterminizmine bağlı (process-içi tutarlı, çağrılar-arası değişken); sağlam sonuç yukarıdaki tolerance'tan bağımsız istatistiktir.
- 24:35/İbn Kesîr aykırısı: köprüde stabil (fark 5.87e-4) → V değişmemiş; ama Beyan 1'deki 0.614 gösteriyor ki V ≠ bugünkü metnin taze 3-large gömümü → metin/versiyon farkı, ayrı byte/normalizasyon sondasına bırakıldı.

## Ortak metodoloji uyarısı
`all_tafsirs.embedding` yazımları raw `$executeRaw UPDATE` ile yapılır → Prisma `@updatedAt` tetiklenmez → `updated_at` embedding yaşam döngüsünü (yazım/düşürme/yeniden-gömme) **tarihlemez**. Bu yüzden embedding provenansı zaman damgasıyla değil, yapısal kanıtla (model-kimliği kosinüsü, dağılım şekli, run-time→bugün köprüsü) kurulur.
