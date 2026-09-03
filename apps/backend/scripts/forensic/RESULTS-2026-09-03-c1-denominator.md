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

**Çapa üçüncü bir kodlayıcı öngörüyor, ama o kişi doldurulmadı; C1 için κ yok.**

> - Third coder (TBD) — secondary coder on C1–C2 and C5–C8 (Quranic-studies criteria). — rubrik satır 24

> 6. **Full coding.** Primary coder (author) codes 100%. Secondary coders code 25% independently
> (different random subsamples for C3–C4 and C1, C2, C5–C8 respectively) for κ verification.
> Final κ reported in Section 5.6 of the paper. — rubrik satır 229

Ön-taahhüt notunda durum (`KITE_on_taahhut_notu_v1.md`):

> …**C1–C2/C5–C8 hücre-düzeyi boyutlar için üçüncü kodlayıcı: TBD.** — satır 77

> 4. Hücre-düzeyi boyutlar (C1/C2/C7/C8, N=12) B.5 uyarınca exploratory; confirmatory κ ≥ 0.75
> yalnızca pair-düzeyi boyutlara (C3/C5/C6) uygulanır. — satır 594

Artefakt teyidi: kodlama dosyalarında C1 alanı yok — `gold-coding-sheet.jsonl` alanları
(`N_human1`, `N_human2`, `S`, `U`, `F_candidate`, `in_prompt`…) C3/NER isim-sayımına aittir;
`adjudications.c3.jsonl` ve `adjudications.suf.jsonl` C3 hattıdır; `kite_c3_reliability.py` içinde
C1/C2/C7/C8 geçmiyor. **C1'in ikinci kodlayıcısı ve κ'sı yok.**

Kesinlik notu: bu bir *tasarım tercihi* değil, **doldurulmamış tasarım**dır — rubrik C1 için ikinci
kodlayıcı ve κ öngörmüştü; kişi atanmadığı için gerçekleşmedi. §5.3'ün "per-axis → C3-only"
düzeltmesi bu tabloyla tutarlıdır (confirmatory κ yalnız C3/C5/C6).

## Ham bulgu özeti

1. C1 çapasının paydası = hücrenin admissible pool'u ("Core 5" = 5; "All 95" = havuzun tamamı).
   42-set çapada hiç geçmiyor; companion'ın "42 normatif benchmark" cümlesi kilitli enstrümana
   yansımamış tasarım niyetidir.
2. Çapadaki payda etiketi ("95") 2026-06-13'te terk edilmiş sayıdır; rubrik 2026-05-13'te kilitlendi.
   Ayrıca "oransal skorla" talimatı ile mutlak bantlar (4–7, ≥8) kendi içinde çelişiyor.
3. 42-dışı müfessirlerin C1'de nasıl sayılacağı **yazılı değil**; çapa metni bunları artı yönde
   okumaya elverişli. Kodlayıcı doğaçladı → C1'in kodlanış biçimine dair ayrı not gerekir.
4. C1 için ikinci kodlayıcı (TBD) hiç atanmadı; C1'de κ yok, artefaktlarla teyitli.
