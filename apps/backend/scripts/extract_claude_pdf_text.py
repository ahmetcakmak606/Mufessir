#!/usr/bin/env python3
"""
Extract readable text from Claude.pdf without third-party dependencies.

This script decodes:
- Flate-compressed content streams
- ToUnicode CMaps
- Text operators in page content streams

Output format (JSON):
{
  "pages": ["...", "..."],
  "fullText": "..."
}
"""

from __future__ import annotations

import json
import re
import sys
import zlib
from pathlib import Path


OBJ_RE = re.compile(rb"(?m)^(\d+)\s+(\d+)\s+obj\s*(.*?)\s*endobj\s*", re.S)


def parse_objects(pdf_bytes: bytes) -> dict[int, bytes]:
  return {int(m.group(1)): m.group(3) for m in OBJ_RE.finditer(pdf_bytes)}


def parse_streams(objects: dict[int, bytes]) -> tuple[dict[int, bytes], dict[int, bytes]]:
  streams: dict[int, bytes] = {}
  dicts: dict[int, bytes] = {}

  for oid, content in objects.items():
    if b"stream" not in content:
      dicts[oid] = content
      continue

    pre, post = content.split(b"stream", 1)
    raw = post
    if raw.startswith(b"\r\n"):
      raw = raw[2:]
    elif raw.startswith(b"\n"):
      raw = raw[1:]

    idx = raw.find(b"endstream")
    if idx >= 0:
      raw = raw[:idx]
    raw = raw.rstrip(b"\r\n")

    dicts[oid] = pre

    if b"/FlateDecode" in pre:
      try:
        decoded = zlib.decompress(raw)
      except Exception:
        continue
    else:
      decoded = raw

    streams[oid] = decoded

  return streams, dicts


def parse_cmaps(streams: dict[int, bytes]) -> dict[int, dict[int, int]]:
  cmap_by_obj: dict[int, dict[int, int]] = {}

  for oid, data in streams.items():
    if b"begincmap" not in data:
      continue

    text = data.decode("latin1", "ignore")
    cmap: dict[int, int] = {}

    for _count, body in re.findall(
      r"(\d+)\s+beginbfrange\s*(.*?)\s*endbfrange", text, flags=re.S
    ):
      for line in body.splitlines():
        line = line.strip()
        m = re.match(
          r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>",
          line,
        )
        if not m:
          continue
        start_h, end_h, base_h = m.groups()
        start = int(start_h, 16)
        end = int(end_h, 16)
        base = int(base_h, 16)
        for code in range(start, end + 1):
          cmap[code] = base + (code - start)

    for _count, body in re.findall(
      r"(\d+)\s+beginbfchar\s*(.*?)\s*endbfchar", text, flags=re.S
    ):
      for line in body.splitlines():
        line = line.strip()
        m = re.match(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", line)
        if not m:
          continue
        src_h, dst_h = m.groups()
        cmap[int(src_h, 16)] = int(dst_h, 16)

    cmap_by_obj[oid] = cmap

  return cmap_by_obj


def parse_font_maps(objects: dict[int, bytes]) -> tuple[dict[int, int], dict[int, dict[str, int]]]:
  font_to_cmap: dict[int, int] = {}
  resource_fonts: dict[int, dict[str, int]] = {}

  for oid, content in objects.items():
    m = re.search(rb"/ToUnicode\s+(\d+)\s+0\s+R", content)
    if m:
      font_to_cmap[oid] = int(m.group(1))

  for oid, content in objects.items():
    m = re.search(rb"/Font\s*<<(.+?)>>", content, re.S)
    if not m:
      continue
    block = m.group(1)
    mapping: dict[str, int] = {}
    for fm in re.finditer(rb"/([A-Za-z0-9]+)\s+(\d+)\s+0\s+R", block):
      mapping[fm.group(1).decode()] = int(fm.group(2))
    if mapping:
      resource_fonts[oid] = mapping

  return font_to_cmap, resource_fonts


def parse_pages(objects: dict[int, bytes]) -> list[tuple[int, int, int]]:
  pages: list[tuple[int, int, int]] = []
  for oid, content in objects.items():
    if b"/Type /Page" not in content:
      continue
    rm = re.search(rb"/Resources\s+(\d+)\s+0\s+R", content)
    cm = re.search(rb"/Contents\s+(\d+)\s+0\s+R", content)
    if rm and cm:
      pages.append((oid, int(rm.group(1)), int(cm.group(1))))
  pages.sort()
  return pages


def decode_hex(hex_text: str, cmap: dict[int, int]) -> str:
  if not hex_text:
    return ""

  if len(hex_text) % 4 == 0:
    step = 4
  elif len(hex_text) % 2 == 0:
    step = 2
  else:
    return ""

  out: list[str] = []
  for i in range(0, len(hex_text), step):
    code = int(hex_text[i : i + step], 16)
    uni = cmap.get(code)
    if uni is None:
      if 32 <= code < 127:
        out.append(chr(code))
      continue
    try:
      out.append(chr(uni))
    except Exception:
      continue
  return "".join(out)


def extract_page_text(
  content_stream: bytes,
  resource_id: int,
  font_to_cmap: dict[int, int],
  resource_fonts: dict[int, dict[str, int]],
  cmap_by_obj: dict[int, dict[int, int]],
) -> str:
  content = content_stream.decode("latin1", "ignore")
  current_font: str | None = None
  out: list[str] = []

  pattern = re.compile(
    r"/([A-Za-z0-9]+)\s+[0-9.]+\s+Tf|<([0-9A-Fa-f]+)>\s*Tj|\[(.*?)\]\s*TJ",
    flags=re.S,
  )

  for m in pattern.finditer(content):
    if m.group(1):
      current_font = m.group(1)
      continue

    cmap: dict[int, int] = {}
    if current_font:
      font_obj = resource_fonts.get(resource_id, {}).get(current_font)
      if font_obj is not None:
        cmap_obj = font_to_cmap.get(font_obj)
        if cmap_obj is not None:
          cmap = cmap_by_obj.get(cmap_obj, {})

    if m.group(2):
      out.append(decode_hex(m.group(2), cmap))
      continue

    array_body = m.group(3) or ""
    parts = re.findall(r"<([0-9A-Fa-f]+)>", array_body)
    if parts:
      out.append("".join(decode_hex(part, cmap) for part in parts))

  return " ".join("".join(out).split())


def extract_text(pdf_path: Path) -> dict[str, object]:
  pdf_bytes = pdf_path.read_bytes()
  objects = parse_objects(pdf_bytes)
  streams, _dicts = parse_streams(objects)
  cmap_by_obj = parse_cmaps(streams)
  font_to_cmap, resource_fonts = parse_font_maps(objects)
  pages = parse_pages(objects)

  page_texts: list[str] = []
  for _page_oid, resource_id, content_id in pages:
    content_stream = streams.get(content_id, b"")
    if not content_stream:
      page_texts.append("")
      continue
    page_texts.append(
      extract_page_text(
        content_stream=content_stream,
        resource_id=resource_id,
        font_to_cmap=font_to_cmap,
        resource_fonts=resource_fonts,
        cmap_by_obj=cmap_by_obj,
      )
    )

  return {"pages": page_texts, "fullText": "\n\n".join(page_texts)}


def main() -> int:
  if len(sys.argv) != 2:
    print("Usage: extract_claude_pdf_text.py <path-to-pdf>", file=sys.stderr)
    return 2

  pdf_path = Path(sys.argv[1])
  if not pdf_path.exists():
    print(f"File not found: {pdf_path}", file=sys.stderr)
    return 2

  data = extract_text(pdf_path)
  print(json.dumps(data, ensure_ascii=False))
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
