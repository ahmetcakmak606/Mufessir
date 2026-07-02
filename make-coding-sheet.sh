#!/usr/bin/env bash
# make-coding-sheet.sh  (v3 — §C3 beş yapısal hücre; exact üyelik + iki katman)
# Üretir:
#   gold-coding-sheet.raw.jsonl   — deterministik taban (ham data'dan; el değmez)
#   gold-coding-sheet.jsonl       — .raw + adjudications.jsonl overlay (insan-kararları)
#
# v2 → v3 değişiklikleri:
#   [FIX] jq `contains([X])` substring eşleşmesiydi (id "6" ⊂ "16" → Al-Akhfash
#         yanlışlıkla in_prompt). Tüm küme-üyelikleri exact `memb()` ile değiştirildi.
#   [YENİ] Final `U` kolonu (insan-adjudike; κ-dışı). `U_machine` donuk tanı kolonu
#          olarak korunur (makine recall'u hesabı için). U := U_machine seed, overlay
#          düzeltir. is_S ve is_U raw'da makine-named'e göre ayrışır; overlay insan
#          serbest-NER'ini uygular (ör. run_040/İbn Ebî Zemenîn: makine kaçırdı).
#   [YENİ] İki katman: builder .raw yazar; overlay .raw → final. Yeniden-üretim
#          insan-kararlarını EZMEZ (idempotent). adjudications.jsonl yoksa .raw kopyalanır.
#   [YENİ] Kendi kendini denetleyen assert: total=82, in_prompt=58, her run in_prompt<=5.
#
# Sütun grupları:
#   [kimlik]    runId, verse, preset, temp, rep, scholarId, scholarName
#   [yapı]      in_prompt — prompt'a girdi; N/not-N kodlaması (κ'ya girer)
#               S         — retrieved ∧ ¬prompt ∧ ¬named; yapısal, κ-dışı
#               U         — retrieved ∧ ¬prompt ∧ named (final, adjudike); κ-dışı
#               U_machine — aynı, makine-named'e göre (donuk tanı; recall için)
#               F_candidate — ¬retrieved ∧ named; insan-adjudike; κ-dışı
#   [kodlayıcı] N_human1, N_human2 — boş başlar; yalnız in_prompt=true kodlanır
#
# Kullanım: bash make-coding-sheet.sh
# Gereksinimler: jq >= 1.6, kite-results.jsonl, kite-attribution.jsonl
#                (opsiyonel) adjudications.jsonl

set -euo pipefail

RAW=gold-coding-sheet.raw.jsonl
FINAL=gold-coding-sheet.jsonl
ADJ=adjudications.jsonl

# ---------------------------------------------------------------------------
# 1) DETERMİNİSTİK TABAN → .raw
# ---------------------------------------------------------------------------
jq -rn \
  --slurpfile results kite-results.jsonl \
  --slurpfile attr    kite-attribution.jsonl \
'
# exact küme-üyeliği (contains[] substring tuzağına karşı)
def memb($arr; $x): ($arr | any(. == $x));

# Gold-set 12 hücre (KITE_on_taahhut_notu_v1.md Ek B — kilitli)
[
  "run_013_M2_3-7_r1",       "run_022_M2_20-5_r1",       "run_016_M2_24-35_r1",
  "run_019_M2_27-18-19_r1",  "run_037_M4_3-7_r1",        "run_046_M4_20-5_r1",
  "run_040_M4_24-35_r1",     "run_043_M4_27-18-19_r1",   "run_058_M6_20-5_r1",
  "run_055_M6_27-18-19_r1",  "run_028_M3_24-35_r1",      "run_001_M1_3-7_r1"
] as $GOLD |

( $results | map({key: .runId, value: .}) | from_entries ) as $res |
( $attr    | map({key: .runId, value: .}) | from_entries ) as $atr |

# Scholar adı: retrieved_all (primary) + named_attributions .en (F fallback)
( [ $results[].retrieved_all[]?   | {key: (.scholarId | tostring), value: .scholarName} ] +
  [ $attr[].named_attributions[]? | {key: (.id | tostring),        value: .en          } ]
  | from_entries ) as $names |

$GOLD[] |
. as $run |
$res[$run] as $r |
$atr[$run] as $a |

# Retrieved: benzersiz scholar ID (string)
( $r.retrieved_all // [] | map(.scholarId | tostring) | unique ) as $ret |

# Prompt-included IDs: display-name → ID (EXACT ad eşleşmesi)
( ($r.prompt_included // [] | unique) as $pnames |
  $r.retrieved_all // [] |
  map(select(.scholarName as $n | $pnames | any(. == $n))) |
  map(.scholarId | tostring) | unique
) as $prompt_ids |

# Makine-named IDs (adjudicator için; kodlayıcıya gösterilmez)
( $a.named_attributions // [] | map(.id | tostring) | unique ) as $named_m |

# Beş yapısal hücre kümeleri (EXACT üyelik)
( $named_m - $ret ) as $f_cands |                                   # ¬retrieved ∧ named
( $ret | map(select(. as $s | (memb($prompt_ids; $s) | not) and memb($named_m; $s))) ) as $u_machine |  # retrieved ∧ ¬prompt ∧ named_m

# Satır evreni: retrieved ∪ F adayları
( $ret + $f_cands | unique ) |
.[] |
. as $sid |

# Beş hücre etiketleri (EXACT üyelik)
( memb($prompt_ids; $sid) ) as $in_prompt |
( (memb($ret; $sid)) and ($in_prompt | not) and (memb($named_m; $sid) | not) ) as $is_S |
( memb($u_machine; $sid) ) as $is_U |
( memb($f_cands;   $sid) ) as $is_F |

{
  runId:       $run,
  verse:       $r.verse.label,
  preset:      $r.presetName,
  temp:        $r.temperature,
  rep:         $r.replication,
  scholarId:   ($sid | tonumber),
  scholarName: ($names[$sid] // "UNKNOWN"),
  in_prompt:   $in_prompt,
  S:           $is_S,
  U:           $is_U,          # final (adjudike); seed = makine, overlay düzeltir
  U_machine:   $is_U,          # donuk tanı (recall için); overlay dokunmaz
  F_candidate: $is_F,
  N_human1:    null,
  N_human2:    null
}
' > "$RAW"

echo "[1/3] $RAW yazıldı."

# ---------------------------------------------------------------------------
# 2) OVERLAY → final  (idempotent; adjudications.jsonl yoksa .raw kopyalanır)
# ---------------------------------------------------------------------------
if [[ -f "$ADJ" ]]; then
  jq -c --slurpfile adj "$ADJ" '
    . as $row
    | ( $adj
        | map(select(.runId == $row.runId
                     and ((.scholarId | tostring) == ($row.scholarId | tostring))))
        | .[0] ) as $a
    | if $a
      then reduce ($a.set | to_entries[]) as $e (.; .[$e.key] = $e.value)
      else . end
  ' "$RAW" > "$FINAL"
  echo "[2/3] $FINAL yazıldı (overlay: $(jq -s length "$ADJ") adjudication uygulandı)."
else
  cp "$RAW" "$FINAL"
  echo "[2/3] $FINAL yazıldı (adjudications.jsonl yok; .raw kopyalandı)."
fi

# ---------------------------------------------------------------------------
# 3) DOĞRULAMA + ASSERT  (defensive: 58/22/…/82 tutmuyorsa exit 1)
# ---------------------------------------------------------------------------
jq -rs '
  { total:       length,
    in_prompt:   (map(select(.in_prompt))    | length),
    S:           (map(select(.S))            | length),
    U:           (map(select(.U))            | length),
    U_machine:   (map(select(.U_machine))    | length),
    F_candidate: (map(select(.F_candidate))  | length),
    unknown_name:(map(select(.scholarName == "UNKNOWN")) | length),
    per_run_over5: ( group_by(.runId)
                     | map({ runId: .[0].runId,
                             ip: (map(select(.in_prompt)) | length) })
                     | map(select(.ip > 5)) )
  }
  | "  total=\(.total)  in_prompt=\(.in_prompt)  S=\(.S)  U=\(.U)  U_machine=\(.U_machine)  F=\(.F_candidate)  unknown_name=\(.unknown_name)",
    ( if .total != 82        then "  [FAIL] total != 82"            else "  [ok] total=82" end),
    ( if .in_prompt != 58    then "  [FAIL] in_prompt != 58 (kappa tabanı bozuk)" else "  [ok] in_prompt=58" end),
    ( if (.per_run_over5|length) > 0 then "  [FAIL] in_prompt>5 olan run(lar): \(.per_run_over5)" else "  [ok] her run in_prompt<=5" end),
    ( if .unknown_name > 0   then "  [WARN] UNKNOWN isimli \(.unknown_name) satır" else empty end)
' "$FINAL"

# assert (exit 1 on structural failure)
jq -es '
  (map(select(.in_prompt)) | length) as $ip
  | (length) as $tot
  | ( group_by(.runId) | map(map(select(.in_prompt))|length) | max ) as $mx
  | ($tot == 82 and $ip == 58 and $mx <= 5)
' "$FINAL" >/dev/null || { echo "[3/3] ASSERT BAŞARISIZ — sheet kullanıma hazır DEĞİL."; exit 1; }
echo "[3/3] Assert geçti — gold-coding-sheet.jsonl kodlamaya hazır."
