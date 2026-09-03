# KITE forensik — Brief B: C1'in paydası, rubrik-çapa okuması (§5.3)

Kaynak: `KITE_rubric_anchors_v1.md` (locked v1.0, `frozen_at: 2026-05-13`, Obsidian/MufessirAI_Project).
Read-only okuma; kod yok, DB yok, OpenAI yok. C1 insan-kodlu olduğundan denetlenen şey **çapa metnidir**.

## (a) C1 çapası paydayı ne tanımlıyor?

**Payda = hücrenin scholar-set konfigürasyonuna göre *admissible pool*. 42-set değil.**
Rubrikte "42" dizgisi **hiç geçmiyor** (tam metin taraması). Birebir alıntılar:

> **What we measure.** Of the scholars admissible to the model under the cell's scholar-set
> configuration, how many distinct mufassirūn appear with clearly attributed views in the output?
> — satır 65

> **Pool-size adjustment.** The same absolute count means different things across cells.
> M4 (All 95) reaching 7 distinct mufassirs is "partial"; M2 (Core 5) reaching 5 is "comprehensive."
> Always score relative to the *admissible pool*, never the absolute count. — satır 67

> **3 — Partial.** Roughly half the admissible pool appears with at least one view each.
> For Core 5 cells: 2–3 of 5 named. For All 95 cells: 4–7 distinct mufassirs cited. — satır 73

> **5 — Comprehensive.** Output surfaces the full available range. For Core 5: all five appear with
> at least one identifiable view. For All 95: eight or more distinct mufassirs, including at least one
> outside the dominant Sunni-Ashʿarī mainstream if available in pool (a Muʿtazilī, Māturīdī,
> Ḥanbalī-traditionalist, or Shīʿī voice). — satır 75

Worked Example ve yorum satırı aynı paydayı doğruluyor:

> **C1 = 2.** Two mufassirs named (Ṭabarī, al-Rāzī) of 5 admissible. Below "partial." — satır 199

> If it came from M4 (All 95, T 0.7), the K score in particular would be alarming — the model had
> **95 scholars available** and surfaced two. — satır 218

**Companion ile çelişki.** Tasarım niyetini söyleyen cümle `Kulliyyah_Test_cati_v3_4bolum.md` satır 249'da
(brief'te "companion satır 249" diye anılan yer; rubriğin kendi `companion_to` alanı
`makale_mimarisi_v2_EN.md`'yi gösteriyor ama 42-benchmark cümlesi çatı v3'te):

> Retaining N=91 for M4 is deliberate: restricting retrieval to the 42 full-coverage tafsirs would make
> the system appear *more* kullī than it operationally is… **the 42 set functions as the normative
> coverage benchmark against which C1–C2 are scored.**

Bu niyet **kilitli çapaya yazılmamıştır.** Çapa 42'yi hiç anmıyor; paydayı hücre konfigürasyonuna bağlıyor.

**İki ek tutarsızlık (kayda geçirilir):**

1. **Payda etiketi eskimiş.** Çapa "All 95" diyor. "95" 2026-06-13'te terk edildi
   (çatı v3 §2.2: 91 retrieval havuzu / 42 küllî set / 97 bildiri). Rubrik 2026-05-13'te,
   yani terk kararından ~1 ay **önce** donduruldu; append-only kilidi nedeniyle güncellenmedi.
   Yani çapadaki payda ne 42, ne 91 — artık hiçbir tabloya karşılık gelmeyen 95'tir.
2. **"Oransal" talimat ile operasyonel bant çelişiyor.** Satır 67 "always score relative to the
   admissible pool" diyor; ama All-hücreleri için bantlar **mutlak sayıdır** (partial = 4–7,
   comprehensive = ≥8). Havuz 95 (veya 91) iken "roughly half" ≈ 45–48 olurdu, 4–7 değil.
   Ayrıca fiilî M4 havuzu âyet-başına değişkendir (63 / 75 / 79 / 95 satır) — bu üçüncü payda
   adayı (per-verse havuz) da çapada geçmiyor.

## (b) Havuzdan gelen ama 42-dışı bir müfessir çıktıda görününce C1'de sayılıyor mu?

**Çapada yazılı DEĞİL.** Rubrikte 42-set / küllî-set ayrımı hiç yok; dolayısıyla "42-dışı bir isim
sayılır / yok sayılır" kuralı da yok. Havuz-üyeliğine dair tek yazılı kural C4'te ve *korpus*
düzeyindedir (42 düzeyinde değil):

> **1 — Fabricated mufassir or quotation.** Output cites a mufassir not in the corpus… — C4 çapası

Aksine, C1'in 5 çapası 42-dışı sınıfı **ödüllendiriyor** görünüyor: "at least one outside the dominant
Sunni-Ashʿarī mainstream if available in pool" (satır 75). Çatı v3 §249'a göre 91−42 ≈ 49 eser tam olarak
bu sınıftır (kısmî/seçmeli/işârî; ör. Tüsterî, Râgıb). Yani çapa metni, companion'ın "42 normatif
benchmark" niyetinin tersine, havuzdaki 42-dışı sesleri C1'de artı yönde sayacak biçimde okunur.

**Sonuç:** kural yazılı olmadığı için kodlayıcı bu noktada **doğaçlamıştır**. Bu, C1'in *nasıl kodlandığına*
dokunur ve ayrı bir not gerektirir: gerçek payda, kodlayıcının hücre-başına fiilen uyguladığı paydadır;
çapa metninden geriye doğru tanıtlanamaz.

## (c) C1 tek-kodlu mu → κ var mı?

**Tek-kodlu, κ yok — ve bu "doldurulmamış TBD" değil, kapatılmış bir karardır.**

Rubrik (kilitli v1.0, 2026-05-13) üçüncü kodlayıcı öngörüyordu:

> - Third coder (TBD) — secondary coder on C1–C2 and C5–C8 (Quranic-studies criteria). — rubrik satır 24

> 6. **Full coding.** Primary coder (author) codes 100%. Secondary coders code 25% independently
> (different random subsamples for C3–C4 and C1, C2, C5–C8 respectively) for κ verification.
> Final κ reported in Section 5.6 of the paper. — rubrik satır 229

Ama bu plan 2026-07-09'da **resmen kapatıldı** (`Kulliyyah_Test_cati_v3_4bolum.md` satır 276):

> *(Superseded note, 2026-07-09: the earlier three-coder plan — "third coder TBD for C1–C2/C5–C8,
> settle before Sprint 4" — is closed; v2 Open Question 1 resolved in favour of the two-coder design
> with disclosed adjudication asymmetries…)* **C1–C2 and C5–C8 were single-coded by the author** under
> the two-coder resolution above, and C4 is single-valued, so no inter-rater κ is defined for them;
> their reliability rests on the anchored, locked codebook and on adjudication rather than on
> inter-coder agreement. **κ is therefore reported for C3, not per axis.**

Ön-taahhüt notu (append-only, daha erken tarihli) hâlâ "üçüncü kodlayıcı: TBD" (satır 77) diyor;
bağlayıcı olan çatı v3'teki kapanış kaydıdır. Satır 594 aynı yöne bakıyor: hücre-düzeyi boyutlar
(C1/C2/C7/C8, N=12) exploratory; confirmatory κ ≥ 0.75 yalnız pair-düzeyi (C3/C5/C6).

Artefakt teyidi: mevcut tek kodlama sayfası C3/NER hattıdır — `gold-coding-sheet.cuneyt.*` ve
`.coder2.*` alanları `{runId, scholarId, scholarName, code, in_prompt[, note]}`; C1–C8 skor alanı yok.
`kite_c3_reliability.py` içinde C1/C2/C7/C8 geçmiyor. §5.3'ün "per-axis → C3-only" düzeltmesi
çatı v3 satır 276 ile birebir örtüşüyor.

## (d) C1 fiilen kodlandı mı? — **HAYIR, henüz kodlanmadı**

`Kulliyyah_Test_cati_v3_4bolum.md` satır 306, §4.5.1 (Coverage) içinde açık yer-tutucu taşıyor:

> …coverage scores are invariant across these cells and any observed variance is noise.
> **⟨C1/C2 scores: pending human coding; cell-level SD across k=3: pending.⟩**

Aynı biçimde satır 312 (C4 gold-NER sayımı), 316 (C3 κ/raw/PABAK), 179 (κ = ●●) de "pending".
Hücre-düzeyi (C1/C2/C7/C8, N=12) kodlama sayfası hiçbir yerde **yok**: ne repo kökünde, ne
`cuneyt_mehmet_coding/` altında, ne `~/Downloads/xx_desktop/cuneyt-kodlama/` altında. Tüm proje
taramasında "C1 = <sayı>" kalıbının tek örneği rubriğin **varsayımsal** Worked Example'ıdır
(satır 199, Q 3:7 için uydurma çıktı). Gerçek koşumlara ait tek bir C1 skoru mevcut değildir.

### Öncelenen ikinci soru: kodlayıcı hangi paydayı fiilen kullandı?

**Şu an cevapsız — çünkü fiilî payda henüz yok.** Soru geriye dönük bir denetim sorusu değil,
**ileriye dönük bir ön-taahhüt sorusudur**: C1 kodlanmadığı için payda hâlâ kodlama başlamadan
sabitlenebilir (pre-registration açısından açık pencere).

Sabitlenecek üç aday payda, ve her birinin mekanik sonucu:

| aday payda | değer | kaynak | M4 skoruna etkisi |
|---|---|---|---|
| çapadaki etiket | "All 95" | rubrik satır 67/73/75 (kilitli) | terk edilmiş sayı; hiçbir tabloya karşılık gelmiyor |
| retrieval havuzu | 91 | çatı v3 §2.2 / satır 249 | havuz-oranı kuralına geçilirse bantlar yeniden tanımlanmalı |
| küllî referans seti | 42 | çatı v3 satır 249 ("normative coverage benchmark") | companion'ın niyeti; çapaya hiç yazılmadı |
| *(dördüncü, çapada geçmeyen)* per-verse havuz | 63 / 75 / 79 / 95 | fiilî `retrieved_all` | hücreden hücreye değişken payda |

Mekanik not: çapanın All-hücresi bantları **mutlak sayıdır** (partial = 4–7, comprehensive = ≥8),
paydadan bağımsızdır. Yani payda seçimi C1 skorunu ancak **oransal bir kurala geçilirse** değiştirir;
mevcut kilitli metinle kodlanırsa payda etiketi skoru etkilemez, yalnız gerekçe cümlesini etkiler.
Bu ayrım (a)'daki iç tutarsızlığın doğrudan sonucudur ve karar verilirken açıkça ele alınmalıdır.

## Ham bulgu özeti

1. C1 çapasının paydası = hücrenin admissible pool'u ("Core 5" = 5; "All 95" = havuzun tamamı).
   42-set çapada hiç geçmiyor; companion'ın (çatı v3 satır 249) "42 normatif benchmark" cümlesi
   kilitli enstrümana yansımamış tasarım niyetidir.
2. Çapadaki payda etiketi ("95") 2026-06-13'te terk edilmiş sayıdır; rubrik 2026-05-13'te kilitlendi.
   Ayrıca "oransal skorla" talimatı ile mutlak bantlar (4–7, ≥8) kendi içinde çelişiyor.
3. 42-dışı müfessirlerin C1'de nasıl sayılacağı **yazılı değil**; çapa metni bunları artı yönde
   okumaya elverişli ("outside the dominant Sunni-Ashʿarī mainstream").
4. C1 tek-kodlu ve κ'sız — **karar gereği** (üç-kodlayıcı planı 2026-07-09'da kapatıldı, çatı v3
   satır 276), doldurulmamış TBD değil. §5.3 "per-axis → C3-only" düzeltmesiyle örtüşüyor.
5. **C1 fiilen henüz kodlanmadı** (çatı v3 satır 306: "pending human coding"); hücre-düzeyi kodlama
   sayfası hiçbir yerde yok. Dolayısıyla "kodlayıcı hangi paydayı kullandı" sorusunun bugün bir
   cevabı yok — payda hâlâ kodlama öncesinde sabitlenebilir. (3) maddesindeki doğaçlama riski de
   gerçekleşmiş bir olgu değil, **önlenebilir** bir açıktır.

---

## Kapanış (2026-09-03, aynı gün): payda kodlama başlamadan sabitlendi

Yukarıdaki (d) maddesinin bıraktığı açık pencere kullanıldı. Karar **çift raporlama**:
kodlayıcı bir kez sayar, **C1_havuz** (v1.0 tanımı + bantları, değişmedi) ve **N_küllî**
(42-set üyeleri, **ham sayım**, bantlanmaz) mekanik türer; fark Δ ham sayılar üstünden.
Gerekçe: kilitli enstrüman geriye dönük değiştirilmedi — v1.0'ın çapa-5'i havuzdaki
ana-akım-dışı sesleri artı yönde ödüllendiriyor, 42-only payda bu ödülü silip enstrümanın
yönünü tersine çevirirdi.

- Ek: `KITE_rubric_anchors_v1.1_C1_eki.md` (frozen 2026-09-03, md5 `c00ee7e4065a50922971e960bfb216b2`),
  D7/D7.1 kalıbı: kodbook'a dokunulmadı, ek yalnız raporlama katmanında bağlayıcı, geriye dönük etki yok.
- Ön-taahhüt kaydı: `KITE_on_taahhut_notu_v1.md` **B.18** (append-only, yeni tarihli madde).
- Kör enstrüman paketi: `cuneyt_mehmet_coding/c1-kodlama/` — 63 kalem opak id + rastgele sıra,
  yalnız `aiResponse`; araç isim aramaz, aday listesi göstermez, skor sormaz (bant sonradan mekanik).
  Mühürlü anahtar açılmadı.
- **Kodlama öncesi kilitlenen ön-bulgu:** Zemahşerî (id 19) 42-set'te **yok** → Core-5 hücrelerinde
  N_küllî en fazla 4. Δ yorumlanırken bu sabit fark anılmazsa yapay "eksik kapsam" okuması doğar.
- Makale §5.3 düzeltildi (havuza göre puanla + küllî sete göre ayrıca raporla; κ per-axis → C3-only),
  dipnot 30a eklendi. §4.1 ayrı olarak kapatıldı (bkz. `RESULTS-2026-09-03-core5-path.md`).

Bu dosyadaki (b) maddesinin "kodlayıcı doğaçladı" riski **gerçekleşmeden** kapatıldı: 42-dışı
isimlerin muamelesi artık yazılı ve mekaniktir.
