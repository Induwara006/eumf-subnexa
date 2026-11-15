"""Decode subtitle file bytes (SRT / ASS) into text, whatever the encoding is.

Order of attempts:
1. Byte order mark (UTF-8 BOM, UTF-16, UTF-32)
2. Strict UTF-8
3. UTF-16 without BOM (detected by NUL bytes)
4. Mostly-ASCII files (a few accented letters, typical for English subtitles):
   Windows-1252, which is by far the most likely encoding
5. charset-normalizer, if installed (pip install charset-normalizer)
6. Windows-1252, then Latin-1 (Latin-1 never fails, so this always returns)

Usage:
    from subtitle_decode import decode_subtitle_bytes
    text, encoding = decode_subtitle_bytes(raw_bytes)
"""

from __future__ import annotations

_BOMS = (
    (b"\xff\xfe\x00\x00", "utf-32"),
    (b"\x00\x00\xfe\xff", "utf-32"),
    (b"\xef\xbb\xbf", "utf-8-sig"),
    (b"\xff\xfe", "utf-16"),
    (b"\xfe\xff", "utf-16"),
)


def _clean(text: str) -> str:
    return text.lstrip("\ufeff").replace("\x00", "")


def decode_subtitle_bytes(raw: bytes) -> tuple[str, str]:
    """Return (text, encoding_used). Raises ValueError only for an empty file."""
    if not raw or not raw.strip():
        raise ValueError("Subtitle file is empty.")

    for bom, enc in _BOMS:
        if raw.startswith(bom):
            try:
                return _clean(raw.decode(enc)), enc
            except UnicodeDecodeError:
                break

    try:
        return _clean(raw.decode("utf-8")), "utf-8"
    except UnicodeDecodeError:
        pass

    head = raw[:400]
    if b"\x00" in head:
        for enc in ("utf-16-le", "utf-16-be"):
            try:
                text = raw.decode(enc)
                if "-->" in text:
                    return _clean(text), enc
            except UnicodeDecodeError:
                continue

    non_ascii = sum(1 for b in raw if b > 127)
    if non_ascii / len(raw) < 0.02:
        try:
            return _clean(raw.decode("cp1252")), "cp1252"
        except UnicodeDecodeError:
            pass

    try:
        from charset_normalizer import from_bytes

        best = from_bytes(raw).best()
        if best is not None and best.encoding:
            return _clean(str(best)), best.encoding
    except Exception:
        pass

    try:
        return _clean(raw.decode("cp1252")), "cp1252"
    except UnicodeDecodeError:
        return _clean(raw.decode("latin-1")), "latin-1"
