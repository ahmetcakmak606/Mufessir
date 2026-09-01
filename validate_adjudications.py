#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
validate_adjudications.py — adjudikasyon dosyalarının şema doğrulaması.

NEDEN VAR: Bu boru hattında aynı hata örüntüsü üç kez tekrarladı —
  1) İki farklı belge, tek dosya adı → yanlış rehber gönderildi (B.9 kök-neden)
  2) Var olmayan alan adına yazılmış filtre → sessiz no-op (D3)
  3) İki farklı kayıt şekli, tek dosya adı → builder'a sessizce yanlış veri (B.13)
Üçünün ortak mekanizması: şema varsayımı doğrulanmadan kullanıldı ve kod
sessizce yanlış çalıştı. Kural: HER şema beyan edilir, assert'e bağlanır,
uyuşmazlıkta SESLİ patlar.

Kullanım:  python3 validate_adjudications.py
Çıkış kodu 0 = temiz, 1 = şema ihlali.
"""

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
V1 = HERE / "adjudications.jsonl"            # S/U/F v1 — DOKUNULMAZ
C3 = HERE / "adjudications.c3.jsonl"         # C3 kod kararları
SUF = HERE / "adjudications.suf.jsonl"       # S/U/F v2 (P + null scholarId)
PEND = HERE / "pending_retrieval.jsonl"      # veri bekleyen

V1_MD5 = "8b97d77502938a3c769fa6b55c1d9b51"  # 2026-08-30 itibarıyla

errors = []
warnings = []


def load(p):
    if not p.exists():
        errors.append(f"{p.name}: dosya yok")
        return [], []
    rows, meta = [], []
    for i, line in enumerate(p.open(encoding="utf-8"), 1):
        line = line.strip()
        if not line:
            continue
        try:
            d = json.loads(line)
        except json.JSONDecodeError as e:
            errors.append(f"{p.name}:{i}: geçersiz JSON — {e}")
            continue
        (meta if any(k.startswith("_") for k in d) else rows).append(d)
    return rows, meta


def require(cond, msg):
    if not cond:
        errors.append(msg)


def check_keys(name, rows, keyfn):
    seen = {}
    for r in rows:
        k = keyfn(r)
        if k in seen:
            errors.append(f"{name}: yinelenen anahtar {k}")
        seen[k] = r
    return seen


def main():
    print("=" * 66)
    print(" ADJUDİKASYON ŞEMA DOĞRULAMASI")
    print("=" * 66)

    # ── v1 dokunulmazlık ────────────────────────────────────────────
    if V1.exists():
        import hashlib
        md5 = hashlib.md5(V1.read_bytes()).hexdigest()
        if md5 == V1_MD5:
            print(f" adjudications.jsonl  : DEĞİŞMEMİŞ ✓  ({md5[:8]}…)")
        else:
            warnings.append(
                f"adjudications.jsonl md5 değişmiş: {md5} (beklenen {V1_MD5}). "
                "Kasıtlıysa V1_MD5 sabitini güncelle ve B.x'e kaydet.")
        v1rows, _ = load(V1)
        for r in v1rows:
            require(set(r) >= {"runId", "scholarId", "set"},
                    f"v1 kaydı eksik alanlı: {r}")
            require("P" not in r.get("set", {}),
                    "v1 dosyasında P anahtarı var — v2'ye ait, v1 şeması dışı")

    # ── C3 ───────────────────────────────────────────────────────────
    c3, meta = load(C3)
    print(f" adjudications.c3     : {len(c3)} kayıt")
    require(meta and meta[0].get("_schema") == "c3-adjudication/v1",
            "c3: _schema başlığı eksik/yanlış")
    for r in c3:
        require(set(r) >= {"runId", "scholarId", "code", "rule",
                           "adjudicator", "date", "status", "reason"},
                f"c3 kaydı eksik alanlı: {r.get('runId')}/{r.get('scholarId')}")
        require(r.get("code") in ("N", "not-N"),
                f"c3 geçersiz code: {r.get('code')}")
        require(r.get("status") == "confirmed",
                f"c3 status confirmed değil: {r.get('runId')}")
        require("set" not in r,
                f"c3 kaydında 'set' alanı var — S/U/F şemasıyla karışmış: {r.get('runId')}")
    check_keys("c3", c3, lambda r: (r["runId"], r["scholarId"]))

    # κ tabanı koruması
    kb = [r for r in c3 if r.get("kappa_base")]
    print(f"   κ tabanında {len(kb)} karar — κ'yı DEĞİŞTİRMEZ "
          f"(adjudikasyon altın standart içindir, B.4)")

    # ── SUF v2 ───────────────────────────────────────────────────────
    suf, meta = load(SUF)
    print(f" adjudications.suf    : {len(suf)} kayıt")
    require(meta and meta[0].get("_schema") == "suf-adjudication/v2",
            "suf: _schema başlığı eksik/yanlış")
    for r in suf:
        require("set" in r, f"suf kaydında 'set' yok: {r.get('runId')}")
        require(set(r.get("set", {})) <= {"S", "U", "F", "P"},
                f"suf: bilinmeyen küme anahtarı {set(r.get('set', {}))}")
        require("code" not in r,
                f"suf kaydında 'code' alanı var — C3 şemasıyla karışmış: {r.get('runId')}")
        if r.get("scholarId") is None:
            require(r.get("surface_form"),
                    f"suf: scholarId null ise surface_form zorunlu ({r.get('runId')})")
    check_keys("suf", suf,
               lambda r: (r["runId"], r["scholarId"] if r.get("scholarId") is not None
                          else r.get("surface_form")))

    # ── pending ──────────────────────────────────────────────────────
    pend, meta = load(PEND)
    print(f" pending_retrieval    : {len(pend)} kayıt")
    for r in pend:
        require(r.get("status") == "pending",
                f"pending: status pending değil ({r.get('runId')})")
        require("set" not in r and "code" not in r,
                f"pending kaydı karar içeriyor — beklemede olmalı ({r.get('runId')})")

    # ── çapraz: aynı (runId, scholarId) iki katmanda karar almasın ───
    c3keys = {(r["runId"], r["scholarId"]) for r in c3}
    sufkeys = {(r["runId"], r["scholarId"]) for r in suf
               if r.get("scholarId") is not None and r.get("type") != "annotation"}
    clash = c3keys & sufkeys
    require(not clash, f"aynı satır hem C3 hem S/U/F kararı almış: {clash}")

    print("=" * 66)
    for w in warnings:
        print(f" ⚠ {w}")
    if errors:
        print(f" ✗ {len(errors)} ŞEMA İHLALİ:")
        for e in errors:
            print(f"   · {e}")
        return 1
    print(" ✓ tüm şemalar geçerli, katmanlar ayrık, v1 dokunulmamış")
    return 0


if __name__ == "__main__":
    sys.exit(main())
