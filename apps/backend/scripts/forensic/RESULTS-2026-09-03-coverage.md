# KITE forensik — korpus kapsam provenansı: bugünkü kısmi doluluk düşüş mü? (2026-09-03)

`kite-coverage-provenance.ts` (read-only). Soru: bugün all_tafsirs'te ~2637/389458 embedded. Koşum (06-22) anında test ayetlerinin havuzu tam gömülüydü (retrieved_all kanıtı). Bugünkü kısmi doluluk **koşum-sonrası bir düşüş mü**, yoksa korpus **hiç tam gömülmedi mi**?

## Cevap: Düşüş DEĞİL. Korpus hiç tam gömülmedi (tamamlanmamış ileri-yönlü kısmi koşum).

### Kanıt 1 — dağılım "full sonra düşürülmüş" değil
- Global: **2637 embedded**, **518 farklı ayete** yayılı (6236 ayetten). Deney-içi 307, deney-dışı 2330 (513 ayet).
- Surah dağılımı: surah 2 = 1136/20542 (**%5.5**), surah 3 = 988/13092, sonra keskin düşüş: surah 27=137, 4=127, 20=66, 24=60, kuyruk 5-23. Min surah 1, max 110, 34 surahta iz.
- **Yorum:** 389K tam gömülüp düşürülseydi surah 2'de ~20.542 beklerdik; 1136 var. Yoğunluk surah 2-3'te + deney surahlarında (27/20/24) → embedding kuyruğunun (generate-embeddings.ts ileri sırayla) erken surahlarda kesildiği tamamlanmamış koşum imzası. Memory (06-22): "tam korpus embed edilmedi, ~382K bekliyor, kredi bekleniyor" ile birebir tutarlı.

### Kanıt 2 — 3-large embeddingler post-run restore'u eler
- Saklı vektörler **3-large** (kanıtlandı, cos≈1.0) = pipeline'a 06-21'de girdi. Satır `updated_at` = 06-12 (toplu load). Post-run bir 06-12-menşeli restore mevcut 2637 3-large vektörü **içeremezdi** (o tarihte 3-large yoktu) → bu vektörler ~06-21/22 yazılıp bugüne dek korunmuş.
- `updated_at` embedding yazımına kör (raw UPDATE) — bu yüzden 2330 deney-dışı satırın tam yazım tarihi tanıtlanamaz (model kimliğiyle **aynı provenans sınıfı**). Ama dağılım şekli + 3-large varlığı "full-then-dropped"ı yapısal olarak eler.

### Kanıt 3 — ölçülen havuzlar bugün de tam (düşüş test verse'lere dokunmadı)
| ayet | toplam müfessir | parent_embedded | chunk_ile_kapsanan | **vektörsüz** |
|---|--:|--:|--:|--:|
| 20-5 | 63 | 61 | 2 | **0** |
| 24-35 | 79 | 59 | 20 | **0** |
| 27-18 | 67 | 66 | 1 | **0** |
| 27-19 | 72 | 71 | 1 | **0** |
| 3-7 | 75 | 50 | 25 | **0** |

Beş deney ayetinin havuzu (parent VEYA chunk) bugün **tam kapsanıyor (vektörsüz=0)** — koşum-anı retrieved_all ile aynı. Düşüş ölçülen ayetlere dokunmamış.

## Sonuç (provenans beyanı)
Run-time korpus kapsamı = bugünkü kapsam **açısından ölçülen ayetler için ÖZDEŞ** (ikisi de tam kapsanan, vektörsüz=0). Global ~2637 kısmi doluluk **düşüş değil**; korpus hiç tam gömülmedi — deney ayetleri + surah 2-3 üzerinde tamamlanmamış ileri-yönlü kısmi koşum. "Kısmi bugün" ≠ "koşumda tamdı" varsayımı yalnız *deney ayetleri için* "tam"dır; genel korpus koşumda da kısmiydi. Kesin global yazım tarihi `updated_at` ile tanıtlanamaz (model kimliğiyle aynı sınıf); yapısal kanıt post-run düşüşü eler.
