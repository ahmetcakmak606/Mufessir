# MüfessirAI — Metadata Standardizasyon Çerçevesi ve Reputation Score Modeli

**Hazırlayan:** Claude AI (Proje Danışmanı)  
**Tarih:** 15 Şubat 2026  
**Durum:** Taslak — Ekip tartışmasına açık

---

## 1. Mevcut Durum Tespiti

Veritabanındaki 98 müfessir kaydının analizi şu tabloyu ortaya koymaktadır:

| Alan | Doluluk | Kritiklik |
|------|---------|-----------|
| `mufassir_en`, `mufassir_ar`, `death_hijri/miladi` | %100 | Temel |
| `mufassir_tr`, `detail_information`, `book_id` | ~%40 | Yüksek |
| `tafsir_type1` | %36 | Orta |
| `century`, `period`, `madhab`, `environment`, `origin_country`, `reputation_score` | **%0** | **Kritik — Gelişmiş mod filtreleri bu alanlara bağımlı** |

---

## 2. Kaynak Hiyerarşisi (Otorite Sıralaması)

Metadata alanlarının doldurulmasında aşağıdaki kaynak hiyerarşisini öneriyorum. Her alan için "birincil" ve "doğrulama" kaynağı belirlemek, akademik tutarlılığı garanti eder.

### 2.1. Birincil Kaynaklar (Primary Sources)

1. **TDV İslâm Ansiklopedisi (DİA)** — Türkçe müfessir isimleri, biyografi, mezhep, coğrafya, dönem bilgileri için en güvenilir Türkçe kaynak. 44 cilt, hakemli, standardize maddeler.

2. **Encyclopaedia of Islam (EI², EI³)** — İngilizce alanlar ve uluslararası akademik standart için. Özellikle `mufassir_en` ve `environment` alanları.

3. **Muhammed Hüseyin ez-Zehebî, *et-Tefsîr ve'l-Müfessirûn*** — Tefsir tarihinde ilk kapsamlı tasnif çalışması. Müfessirlerin yöntembilimsel sınıflandırması ve tefsir türleri (`tafsir_type1`, `tafsir_type2`) için temel referans. *Not: Zehebî'nin mezhep merkezli tasnifinin eleştiriye açık yönleri vardır (Mustafa Öztürk'ün zihniyet analizi; Cündioğlu'nun kronolojik süreklilik eleştirisi); bu durum platformun tarafsızlık ilkesi açısından dikkate alınmalıdır.*

4. **Ömer Nasuhi Bilmen, *Büyük Tefsir Tarihi*** — Osmanlı-Türk tefsir geleneği ve Türkçe terminoloji standardı için. (Zaten IP01 kapsamında CSV'ye aktarılıyor.)

5. **Muhammed Hadi Marifet, *et-Temhîd fî Ulûmi'l-Kur'ân*** — Zehebî'ye alternatif, mezhep-üstü bir tasnif sistemi sunar. Şiî müfessirler dahil daha kapsayıcı bir perspektif.

### 2.2. Doğrulama/Tamamlayıcı Kaynaklar

6. **Kâtip Çelebi, *Keşfü'z-Zünûn*** — Eser bazlı doğrulama ve bibliyografik kontrol.
7. **Fuat Sezgin, *Târîhu't-Türâsi'l-Arabî*** — Özellikle erken dönem müfessirler ve eserleri.
8. **İsmail Cerrahoğlu, *Tefsir Tarihi*** — Türk akademisinde standart ders kitabı.
9. **İsmail Çalışkan, *Tefsir Tarihi* (2019)** — Güncel dönemlendirme tartışmalarını içerir.
10. **Shamela.ws (el-Mektebetü'ş-Şâmile)** — `book_id` eşleştirmesi ve dijital metin erişimi.

### 2.3. Alan Bazlı Kaynak Eşleştirmesi

| Metadata Alanı | Birincil Kaynak | Doğrulama Kaynağı |
|----------------|----------------|-------------------|
| `mufassir_tr` | DİA | Bilmen |
| `mufassir_name_long` | DİA + EI² | Sezgin |
| `century` | **Otomatik hesaplama** (`death_hijri`) | — |
| `period` | Aşağıdaki dönemlendirme modeli | DİA + Çalışkan |
| `madhab` | DİA | Zehebî + Marifet |
| `environment` | DİA + EI² | Sezgin |
| `origin_country` | DİA + EI² | — |
| `tafsir_type1` | Zehebî + Marifet | DİA |
| `tafsir_type2` | Zehebî + Marifet | Cerrahoğlu |
| `explanation` | DİA (özet) | Bilmen |
| `detail_information` | DİA (tam biyografi) | EI² |
| `reputation_score` | **Çok boyutlu model** (aşağıda) | — |
| `book_id` | Shamela.ws | — |

---

## 3. Dönemlendirme Modeli (`period` alanı)

### 3.1. Sorunun Tespiti

Tefsir tarihinde dönemlendirme (*periodization*) başlı başına tartışmalı bir meseledir. Zehebî'nin mezhep merkezli tasnifi, Goldziher'in oryantalist şeması ve Marifet'in rivâyet/dirâyet dikotomisi gibi farklı modeller bulunmaktadır. Her birinin kendi ön kabulleri ve kör noktaları vardır.

MüfessirAI için pragmatik, akademik olarak savunulabilir ve filtreleme için işlevsel bir model gerekiyor.

### 3.2. Önerilen Model: Altı Dönem

Havva Özata'nın dilbilimsel tefsir dönemlendirmesinden ve genel İslam ilimler tarihi periodizasyonundan hareketle aşağıdaki modeli öneriyorum:

| Dönem Kodu | Dönem Adı (TR) | Dönem Adı (EN) | Hicrî Aralık | Miladî Karşılık | Açıklama |
|------------|---------------|----------------|-------------|-----------------|----------|
| `FOUNDATION` | Teşekkül Dönemi | Formative Period | 1-150 H | 622-767 | Sahabe, Tâbiûn, Tebeu't-Tâbiîn. Şifahi rivayet ağırlıklı, tefsirin hadisten bağımsızlaşma süreci. |
| `CLASSICAL_EARLY` | Erken Klasik Dönem | Early Classical | 150-400 H | 767-1010 | Tefsirin müstakil ilim olarak tedvini. Taberî, Mâtürîdî. Rivayet-dirâyet ayrımının belirginleşmesi. |
| `CLASSICAL_MATURE` | Olgun Klasik Dönem | Mature Classical | 400-700 H | 1010-1300 | Tefsir türlerinin çeşitlenmesi. Zemahşerî, Râzî, Kurtubî, İbn Kesîr. Büyük ansiklopedik tefsirlerin dönemi. |
| `POST_CLASSICAL` | Klasik Sonrası Dönem | Post-Classical | 700-1200 H | 1300-1785 | Şerh, hâşiye, ihtisar geleneği. Osmanlı tefsir mirası. Beyzâvî şerhleri, Ebüssuûd. |
| `MODERN` | Modern Dönem | Modern Period | 1200-1400 H | 1785-1980 | Islahçı ve içtimaî tefsir. Reşid Rıza, Merâgî, İbn Âşûr. Batı ile temas ve yeni metodolojiler. |
| `CONTEMPORARY` | Çağdaş Dönem | Contemporary | 1400+ H | 1980-günümüz | Tematik tefsir, hermenötik yaklaşımlar, dijital tefsir çalışmaları. |

### 3.3. Hesaplama Mantığı

`century` alanı `death_hijri` üzerinden otomatik türetilebilir:

```
century = Math.ceil(death_hijri / 100)
```

`period` alanı ise `death_hijri` aralıklarına göre:

```javascript
function getPeriod(death_hijri) {
  if (death_hijri <= 150) return 'FOUNDATION';
  if (death_hijri <= 400) return 'CLASSICAL_EARLY';
  if (death_hijri <= 700) return 'CLASSICAL_MATURE';
  if (death_hijri <= 1200) return 'POST_CLASSICAL';
  if (death_hijri <= 1400) return 'MODERN';
  return 'CONTEMPORARY';
}
```

**Dikkat:** Dönem sınıflandırması müfessirin vefat tarihine göre yapılmaktadır; ancak bir müfessirin aktif olduğu dönem vefatından onlarca yıl önce olabilir. Bu nedenle bu otomatik sınıflandırma *yaklaşık* olup, sınır vakalarında (ör. h. 148'de vefat eden Mukâtil b. Süleyman) manuel düzeltme gerekebilir.

---

## 4. Reputation Score: Tek Puan Yerine Çok Boyutlu Model

### 4.1. Neden Tek Bir Puan Sorunludur?

"Reputation score" kavramı tek bir sayısal değer olarak düşünüldüğünde ciddi akademik ve etik sorunlara yol açar:

1. **Normatif yargı problemi:** Bir müfessiri 7/10 olarak puanlamak, kaçınılmaz olarak "kimin standartlarına göre?" sorusunu doğurur. Sünnî gelenekte düşük puan alacak bir müfessir, Şiî gelenekte en yüksek otoritelerden biri olabilir (ör. Tabersî).

2. **Anakronizm riski:** Modern akademik kriterleri (atıf sayısı, metodolojik tutarlılık) erken dönem müfessirlere uygulamak tarihsel haksızlık yaratır.

3. **Mezhep tarafgirliği:** Zehebî'nin tasnifine yöneltilen en temel eleştiri — mezhep taassubunun tasnife sızması — reputation score'da daha da belirgin hale gelir.

4. **Platformun tarafsızlık ilkesi ile çelişki:** MüfessirAI'ın değer önerisi "objektif analiz" ise, subjektif bir puanlama sistemi bu iddiayı zayıflatır.

### 4.2. Önerilen Alternatif: Çok Boyutlu Reputation Profili

Tek bir `reputation_score` yerine, **ölçülebilir ve doğrulanabilir alt boyutlardan** oluşan bir profil öneriyorum. Bu yaklaşım hem akademik olarak savunulabilir hem de gelişmiş mod filtrelerinde çok daha zengin bir kullanım sunar.

#### Boyut 1: `scholarly_influence` (Akademik Etki) — 1-5 Ölçeği

Müfessirin sonraki tefsir geleneğini ne ölçüde etkilediğinin göstergesi.

- **5:** Tefsir tarihinde paradigma belirleyici (Taberî, Zemahşerî, Râzî)
- **4:** Geniş çapta referans alınan, birden fazla geleneği etkileyen
- **3:** Kendi dönem ve coğrafyasında etkili
- **2:** Sınırlı ancak belirli bir alanda tanınan
- **1:** Az bilinen veya etkisi sınırlı

**Kaynak:** DİA ve EI² maddelerindeki "etki" ve "sonraki gelenek" bölümleri. Taberî'nin *Câmi'* eserinin sonraki tefsirlerin %80'inden fazlasında kaynak gösterilmesi gibi ölçülebilir veriler.

#### Boyut 2: `methodological_rigor` (Metodolojik Titizlik) — 1-5 Ölçeği

Tefsirinde kullandığı yöntemin sistematikliği ve tutarlılığı.

- **5:** Kapsamlı bir usul çerçevesi ile yazılmış, çok katmanlı analiz
- **4:** Belirli bir usul izleyen, kaynaklarını açıkça gösteren
- **3:** Yöntemi var ancak tutarlı şekilde uygulanmıyor
- **2:** Eklektik, belirgin bir usulü yok
- **1:** Yöntem açısından değerlendirme güç

**Kaynak:** Zehebî'nin metot analizleri, DİA maddeleri, ilgili monografiler.

#### Boyut 3: `corpus_breadth` (Külliyat Genişliği) — 1-5 Ölçeği

Tefsirin Kur'an metnini ne ölçüde kapsadığı.

- **5:** Tam tefsir (tüm Kur'an, 30 cüz)
- **4:** Kur'an'ın büyük bölümünü kapsayan
- **3:** Belirli surelere veya geniş bir seçkiye odaklanan
- **2:** Sınırlı sayıda ayet veya sure
- **1:** Fragmanlar veya seçme ayetler

**Kaynak:** Keşfü'z-Zünûn, Shamela metin hacmi, DİA.

#### Boyut 4: `tradition_acceptance` (Gelenek İçi Kabul) — Enum

Hangi gelenek(ler) tarafından otorite olarak kabul edildiği. Tek bir puan yerine **etiket (tag) sistemi** ile:

- `SUNNI_MAINSTREAM` — Sünnî ana akım tarafından kabul
- `MUTAZILI` — Mu'tezilî gelenek
- `SHII_IMAMI` — İmâmî-Şiî gelenek
- `SHII_ZAYDI` — Zeydî gelenek
- `SUFI_ISHARI` — İşârî/Sûfî gelenek
- `IBADI` — İbâdî gelenek
- `SALAFI` — Selefî gelenek
- `CROSS_TRADITION` — Birden fazla gelenekte kabul gören

Bu alan **çoklu değer alabilir.** Örneğin Taberî: `[SUNNI_MAINSTREAM, CROSS_TRADITION]`.

#### Boyut 5: `source_accessibility` (Kaynak Erişilebilirliği) — Enum

Tefsir metninin dijital ortamda erişilebilirlik durumu.

- `FULL_DIGITAL` — Tam metin dijital ortamda mevcut (Shamela, vb.)
- `PARTIAL_DIGITAL` — Kısmen dijitalleştirilmiş
- `MANUSCRIPT_ONLY` — Sadece yazma nüsha
- `LOST` — Kayıp eser (rivayetlerden biliniyor)

### 4.3. Veritabanı Şeması Önerisi

Mevcut tek `reputation_score` (integer) alanı yerine:

```sql
-- Mevcut alanı koruyarak genişletme
ALTER TABLE mufassirs ADD COLUMN scholarly_influence SMALLINT CHECK (scholarly_influence BETWEEN 1 AND 5);
ALTER TABLE mufassirs ADD COLUMN methodological_rigor SMALLINT CHECK (methodological_rigor BETWEEN 1 AND 5);
ALTER TABLE mufassirs ADD COLUMN corpus_breadth SMALLINT CHECK (corpus_breadth BETWEEN 1 AND 5);
ALTER TABLE mufassirs ADD COLUMN tradition_acceptance TEXT[]; -- PostgreSQL array
ALTER TABLE mufassirs ADD COLUMN source_accessibility VARCHAR(20);

-- Geriye dönük uyumluluk: reputation_score hesaplanabilir bir ortalama olarak tutulabilir
-- reputation_score = ROUND((scholarly_influence + methodological_rigor + corpus_breadth) / 3.0, 1)
```

### 4.4. İlk 5 Müfessir İçin Örnek Profil

| Müfessir | scholarly_influence | method_rigor | corpus_breadth | tradition_acceptance | source_access |
|----------|:--:|:--:|:--:|---|---|
| **Taberî** (ö. 310) | 5 | 5 | 5 | SUNNI_MAINSTREAM, CROSS_TRADITION | FULL_DIGITAL |
| **Zemahşerî** (ö. 538) | 5 | 5 | 5 | MUTAZILI, CROSS_TRADITION | FULL_DIGITAL |
| **Mücâhid b. Cebr** (ö. 102) | 4 | 2 | 3 | SUNNI_MAINSTREAM | FULL_DIGITAL |
| **Tabersî** (ö. 548) | 4 | 4 | 5 | SHII_IMAMI | FULL_DIGITAL |
| **Molla Gürânî** (ö. 893) | 3 | 4 | 5 | SUNNI_MAINSTREAM | FULL_DIGITAL |

---

## 5. Uygulama Yol Haritası

### Adım 1: Otomatik Türetme (Tahmini: 1-2 gün)
- `century` ve `period` alanlarını `death_hijri`'den hesapla
- `source_accessibility` alanını `book_id` varlığından türet (book_id varsa → en az `PARTIAL_DIGITAL`)
- Script yazılıp çalıştırılabilir, manuel müdahale gerekmez

### Adım 2: DİA Tabanlı Sistematik Doldurma (Tahmini: 3-4 hafta)
- 98 müfessirin her biri için DİA maddesi kontrol edilir
- `madhab`, `environment`, `origin_country`, `mufassir_tr`, `explanation` alanları doldurulur
- Öncelik: Katman B (58 eksik kayıt), sonra Katman A doğrulama

### Adım 3: Reputation Profili Pilot (Tahmini: 2-3 hafta)
- İlk 20 müfessir (en yüksek `scholarly_influence` beklenenler) için profil oluşturulur
- Ekip içi değerlendirme ve kalibrasyon yapılır
- Puanlama tutarlılığı kontrol edilir (inter-rater reliability)

### Adım 4: Tam Veri Setine Genişleme (Tahmini: 3-4 hafta)
- Kalan 78 müfessir için profil tamamlanır
- `tradition_acceptance` etiketleri doğrulanır
- Shamela `book_id` eşleştirmesi tamamlanır

---

## 6. Açık Sorular ve Tartışma Noktaları

1. **Dönemlendirme sınır vakaları:** Bir müfessir iki dönemin geçiş noktasında ise (ör. Mukâtil b. Süleyman, ö. 150 H — tam sınırda), hangi döneme atanacak? Önerim: vefat tarihi sınır değere eşitse bir önceki döneme atama yapılsın.

2. **Mezhep belirsizliği:** Bazı erken dönem müfessirleri (ör. Mücâhid) henüz mezheplerin teşekkül etmediği bir dönemde yaşamıştır. Bu durumda `madhab` alanı ne olacak? Önerim: `PRE_MADHAB` etiketi kullanılsın.

3. **Reputation boyutlarında sübjektivite:** `scholarly_influence` ve `methodological_rigor` boyutları tamamen objektif olamaz. Kim puanlayacak? Önerim: İlk puanlama ekip tarafından yapılsın, ardından bir "danışma kurulu" (advisory board) tarafından gözden geçirilsin.

4. **Gelişmiş mod UI'da nasıl sunulacak?** Kullanıcıya beş ayrı slider mı gösterilecek, yoksa ön-tanımlı profiller mi sunulacak (ör. "sadece paradigma belirleyici müfessirler")? Bu bir UX kararı.

5. **Tefsir türü (`tafsir_type1/2`) standartları:** Zehebî'nin rivayet/dirâyet ayrımı mı, Marifet'in me'sûr/ictihâdî ayrımı mı, yoksa karma bir model mi? Bu akademik bir tercih meselesi.

---

## 7. Kaynakça

- Bilmen, Ömer Nasuhi. *Büyük Tefsir Tarihi: Tabakâtü'l-Müfessirîn*. İstanbul: Bilmen Yayınevi.
- Cerrahoğlu, İsmail. *Tefsir Tarihi*. Ankara: Fecr Yayınları.
- Çalışkan, İsmail. *Tefsir Tarihi*. Ankara: Bilay Yayınları, 2019.
- Marifet, Muhammed Hadi. *et-Temhîd fî Ulûmi'l-Kur'ân*. Kum, 2007.
- Özata, Havva. "Hz. Peygamber'den Modern Zamana Dilbilimsel Tefsir Faaliyetleri: Bir Dönemlendirme Modeli." 2020.
- Öztürk, Mustafa. "Modern Dönem Tefsir Tarihi Edebiyatına Dair Bir Zihniyet Analizi: Muhammed Hüseyin ez-Zehebî ve et-Tefsîr ve'l-Müfessirûn Örneği." *Tefsir Tarihi Yazımı Sempozyumu*, Ankara, 2015.
- Sezgin, Fuat. *Târîhu't-Türâsi'l-Arabî*. Riyad, 1983.
- TDV İslâm Ansiklopedisi (DİA). İstanbul: TDV Yayınları, 1988-2013.
- Zehebî, Muhammed Hüseyin. *et-Tefsîr ve'l-Müfessirûn*. Kahire: Dârü'l-Hadîs, 2012.
