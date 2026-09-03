#!/usr/bin/env python3
"""
kite_pool42_intersection.py — sorgu-âyeti başına havuz ∩ 42-set kesişimi.

READ-ONLY. Girdi: kite-probe31-v2.jsonl (k=95 tam havuz, kanonik rep=r1) +
kilitli 42-listesi (kulli42_ids.txt, md5 7871e495bc1569626ed7750cf77eef1e).
Çıktı üretmez: hiçbir aiResponse okunmaz, hiçbir isim sayımı yapılmaz.
C1 kodlaması öncesi tavan aritmetiği içindir.
"""
import json, hashlib, os
from collections import OrderedDict

PKG = "/Users/csapanca/CascadeProjects/Obsidian/02_Projects/MufessirAI_Project/cuneyt_mehmet_coding/c1-kodlama"
K42 = os.path.join(PKG, "kulli42_ids.txt")

def md5(p): return hashlib.md5(open(p, "rb").read()).hexdigest()

k42 = {l.strip() for l in open(K42) if l.strip()}
assert len(k42) == 42, len(k42)
assert md5(K42) == "7871e495bc1569626ed7750cf77eef1e", "42-listesi hash'i tutmuyor — DUR"

CORE5 = OrderedDict([("7","Taberî"),("19","Zemahşerî"),("22","Râzî"),("24","Kurtubî"),("29","İbn Kesîr")])

probe = [json.loads(l) for l in open("kite-probe31-v2.jsonl") if l.strip()]
pools = {}
for r in probe:
    if r["replication"] != 1: continue
    v = r["verse"]["label"]
    seen = []
    for e in sorted(r["retrieved_all"], key=lambda x: -x["similarityScore"]):
        sid = str(e["scholarId"])
        if sid not in seen: seen.append(sid)
    pools[v] = dict(rows=len(r["retrieved_all"]), uniq=seen)

L = []
def out(s=""): print(s); L.append(s)

out("# Havuz ∩ 42-set — sorgu-âyeti başına (2026-09-03)")
out()
out("Read-only, C1 kodlaması **öncesi**. Kaynak: `kite-probe31-v2.jsonl` (k=95 tam havuz, rep=r1)")
out(f"+ kilitli liste `kulli42_ids.txt` (md5 `{md5(K42)}`). Hiçbir çıktı metni okunmadı,")
out("hiçbir isim sayımı üretilmedi — bu dosya yalnız **havuz aritmetiğidir**.")
out()
out("## 1. Havuz büyüklüğü ve küllî kesişim")
out()
out("| âyet | havuz (satır) | havuz (tekil müfessir) | ∩ 42-set | havuzun küllî payı | 42-set'in havuzda bulunmayan üyesi |")
out("|---|--:|--:|--:|--:|--:|")
per = {}
for v in ["3:7", "20:5", "24:35", "27:18-19"]:
    u = pools[v]["uniq"]; inter = [s for s in u if s in k42]
    per[v] = dict(rows=pools[v]["rows"], uniq=len(u), inter=len(inter), inter_ids=inter)
    per[v]["missing"] = sorted(k42 - set(u), key=int)
    out(f"| {v} | {pools[v]['rows']} | {len(u)} | **{len(inter)}** | {100*len(inter)/len(u):.1f}% | {42-len(inter)} |")
out()
K42TAB = {r.split(",")[1]: r.split(",")[2] for r in open(os.path.join(PKG,"kulli42.locked.csv")).read().splitlines()[1:]}
out()
out("Havuzda **bulunmayan** küllî üyeler (o âyette hiç satırı yok):")
for v in ["3:7","20:5","24:35","27:18-19"]:
    m = per[v]["missing"]
    out(f"- **{v}** ({len(m)}): " + (", ".join(f"{K42TAB.get(i,'?')} ({i})" for i in m) if m else "—"))
out()
out("Okuma: M4/M5 (allN) hücrelerinde C1_havuz'un paydası soldaki tekil-müfessir sayısı,")
out("N_küllî'nin üst sınırı ise ∩ 42-set sütunudur. İkisi aynı âyette bile birbirinin yarısı kadar.")

out()
out("## 2. Preset tavanları — N_küllî üst sınırı")
out()
runs = [json.loads(l) for l in open("kite-results.jsonl") if l.strip()]
presets = OrderedDict()
for r in runs:
    if r["scholarIds"]:
        presets.setdefault(r["presetName"], set()).update(map(str, r["scholarIds"]))
out("| preset | admissible | ∩ 42-set (tavan) | 42-dışı üyeler |")
out("|---|--:|--:|---|")
NAMES = {"83": "Ferîd Vecdî (83)", "19": "Zemahşerî (19)", "55": "Gazzâlî (55)"}
for p, ids in presets.items():
    inter = sorted(i for i in ids if i in k42)
    dis = sorted(i for i in ids if i not in k42)
    out(f"| `{p}` | {len(ids)} | **{len(inter)}** | {', '.join(NAMES.get(d, d) for d in dis) or '—'} |")
out(f"| `allN` | âyete göre (tablo 1) | tablo 1 ∩ sütunu | — |")
out()
out("**Core-5 tavanı = 4.** Zemahşerî (id 19) kilitli 42 tablosunda yok; beşi de atıflı görünse bile")
out("Core-5 hücrelerinde N_küllî 5 olamaz. M1/M2/M3'ün tamamı ve extended preset'lerin Core-5 çekirdeği")
out("bu tavana tabidir. Δ = N_havuz − N_küllî yorumlanırken bu **sabit** fark anılmazsa, Core-5 hücreleri")
out("yapay olarak 'eksik kapsam' gibi okunur.")
out()
out("## 3. Core-5'in küllî üyeliği (referans)")
out()
out("| müfessir | id | 42-set |")
out("|---|--:|:--:|")
for sid, ad in CORE5.items():
    out(f"| {ad} | {sid} | {'✓' if sid in k42 else '**yok**'} |")
out()
out("## Kullanım sınırı")
out()
out("Bu dosya frozen ek'in (`KITE_rubric_anchors_v1.1_C1_eki.md`) **parçası değildir**; ek'e")
out("dokunulmamıştır. Kodlama paketinin (`c1-kodlama/`) de dışında tutulmuştur — kodlayıcının")
out("kodlama sırasında havuz aritmetiğini görmesi gerekmez ve görmemelidir. Raporlama aşamasında,")
out("mühür açıldıktan sonra kullanılır.")

open("/Users/csapanca/CascadeProjects/Obsidian/02_Projects/MufessirAI_Project/KITE_C1_havuz42_kesisim_2026-09-03.md","w").write("\n".join(L)+"\n")
