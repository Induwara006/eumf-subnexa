"""Turn release-style names into clean library titles.

  "VisionQuest S01E04 1080p 10bit WEBRip 6CH x265 HEVC-PSA"  -> "VisionQuest S01E04"
  "Blade.II.2002.1080p.BluRay.x264-YIFY.srt"                 -> "Blade II", year "2002"
  "Iron Man"                                                 -> "Iron Man"  (unchanged)

parse_release(name) returns a dict:
  title        clean name without year/episode        (used to search TMDB)
  year         "2002" or ""
  episode      "S01E04" or ""
  display      title + episode, what the library shows
"""
from __future__ import annotations

import re
import time

# Tokens that only ever appear in release names: the title stops at the first one.
_STRONG = re.compile(
    r"^(?:\d{3,4}p|[248]k|uhd|fhd|web-?dl|webrip|bluray|blu-ray|bdrip|brrip|bdremux|remux|hdrip|dvdrip|"
    r"hdtv|pdtv|hdcam|amzn|dsnp|hmax|atvp|pmtp|pcok|10bit|8bit|hevc|x26[45]|h26[45]|av1|xvid|divx|"
    r"aac\d*|eac3|ac3|ddp\d*|dd\+?\d+|dts(?:-?hd)?|truehd|atmos|flac|opus|[2568]ch|hdr10\+?|dovi)$",
    re.I,
)
# Words that can also be part of a real title: dropped only when they trail the title.
_WEAK = re.compile(
    r"^(?:web|hd|nf|max|ts|cam|dv|hdr|sdr|imax|repack|proper|extended|unrated|uncut|remastered|internal|"
    r"multi|dual|dubbed|subbed|subs?|esubs?|hc|complete|limited|itunes|hulu)$",
    re.I,
)
_EPISODE = re.compile(r"^s(\d{1,2})(?:e(\d{1,3}))?(?:-?e\d{1,3})*$", re.I)
_YEAR = re.compile(r"^(?:19|20)\d{2}$")


def _tokens(name: str) -> list[str]:
    leaf = re.split(r"[/\\]", name or "")[-1]
    leaf = re.sub(r"\.(srt|ass|vtt)$", "", leaf, flags=re.I)
    leaf = re.sub(r"^\s*\[[^\]]*\]\s*", "", leaf)               # leading [Group] tag
    leaf = re.sub(r"\bh\.?(26[45])\b", r"h\1", leaf, flags=re.I)  # H.264 -> h264
    leaf = re.sub(r"[._\[\]()]+", " ", leaf)
    return leaf.split()


def _smart_case(title: str) -> str:
    letters = [c for c in title if c.isalpha()]
    if len(letters) > 3 and (title.islower() or title.isupper()):
        return title.title()
    return title


def parse_release(name: str) -> dict:
    tokens = _tokens(name)
    cut, episode = len(tokens), ""
    for i, tok in enumerate(tokens):
        if i == 0:
            continue                                         # never cut the title down to nothing
        head = re.split(r"[-+]", tok)[0]
        m = _EPISODE.fullmatch(tok)
        if m and m.group(2):                                 # S01E04 marks the end of the show name
            episode = f"S{int(m.group(1)):02d}E{int(m.group(2)):02d}"
            cut = i
            break
        if _STRONG.fullmatch(tok) or _STRONG.fullmatch(head):
            cut = i
            break
    pre = tokens[:cut]
    while len(pre) > 1 and _WEAK.fullmatch(pre[-1]):
        pre.pop()
    year = ""
    if len(pre) >= 2 and _YEAR.fullmatch(pre[-1]) and int(pre[-1]) <= time.gmtime().tm_year + 1:
        year = pre.pop()
    title = _smart_case(" ".join(pre).strip(" -")) or "Translated subtitles"
    display = f"{title} {episode}".strip()
    return {"title": title[:120], "year": year, "episode": episode, "display": display[:120]}


def library_title(filename: str) -> tuple[str, str]:
    """Same contract as subnexa_library_auto.title_from_filename: (title, year)."""
    parsed = parse_release(filename)
    return parsed["display"], parsed["year"]
