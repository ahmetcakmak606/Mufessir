#!/usr/bin/env python3
"""
Extract structured board items from the Kanban sheet in
MufessirAI_Project_Board_1.xlsx.

Output format (JSON):
[
  {
    "id": "D01",
    "task": "...",
    "status": "DONE",
    "priority": "Kritik",
    "layer": "DevOps",
    "estimate": "—",
    "dependency": "—"
  },
  ...
]
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET


NS = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
TASK_ID_RE = re.compile(r"^[A-Z]+\d+[A-Za-z]*$")


def parse_shared_strings(zf: ZipFile) -> list[str]:
  root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
  shared: list[str] = []
  for si in root.findall("a:si", NS):
    text = "".join((t.text or "") for t in si.findall(".//a:t", NS))
    shared.append(text)
  return shared


def parse_cell_value(cell: ET.Element, shared: list[str]) -> str:
  cell_type = cell.attrib.get("t")
  v = cell.find("a:v", NS)
  if v is not None:
    raw = v.text or ""
    if cell_type == "s":
      try:
        return shared[int(raw)]
      except Exception:
        return raw
    return raw

  inline = cell.find("a:is", NS)
  if inline is not None:
    return "".join((t.text or "") for t in inline.findall(".//a:t", NS))

  return ""


def parse_rows(zf: ZipFile, shared: list[str]) -> list[dict[str, str]]:
  sheet = ET.fromstring(zf.read("xl/worksheets/sheet1.xml"))
  out: list[dict[str, str]] = []
  for row in sheet.findall("a:sheetData/a:row", NS):
    values: dict[str, str] = {}
    for cell in row.findall("a:c", NS):
      ref = cell.attrib.get("r", "")
      col = "".join(ch for ch in ref if ch.isalpha())
      values[col] = parse_cell_value(cell, shared)
    if values:
      out.append(values)
  return out


def extract_items(rows: list[dict[str, str]]) -> list[dict[str, str]]:
  items: list[dict[str, str]] = []
  for row in rows:
    item_id = row.get("A", "").strip()
    if not TASK_ID_RE.match(item_id):
      continue

    items.append(
      {
        "id": item_id,
        "task": row.get("B", "").strip(),
        "status": row.get("C", "").strip().upper(),
        "priority": row.get("D", "").strip(),
        "layer": row.get("E", "").strip(),
        "estimate": row.get("F", "").strip(),
        "dependency": row.get("G", "").strip(),
      }
    )
  return items


def main() -> int:
  if len(sys.argv) != 2:
    print("Usage: extract_board_items.py <path-to-xlsx>", file=sys.stderr)
    return 2

  xlsx_path = Path(sys.argv[1])
  if not xlsx_path.exists():
    print(f"File not found: {xlsx_path}", file=sys.stderr)
    return 2

  with ZipFile(xlsx_path) as zf:
    shared = parse_shared_strings(zf)
    rows = parse_rows(zf, shared)
    items = extract_items(rows)

  print(json.dumps(items, ensure_ascii=False))
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
