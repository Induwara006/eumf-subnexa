"""Cloudflare-only batching for SubNexa 0.2 (V4.8).

A target of 1,000 subtitle entries is a *ceiling*, not a guarantee that
1,000 arbitrary subtitles fit the chosen provider's token/output limits.
The Gemini adaptive planner is not changed.
"""
from __future__ import annotations

import os

MAX_CF_LINES = 1000
# The current Cloudflare adapter caps output at 8,192 tokens. Sinhala may
# consume many tokens per character. Conservative English-char planning
# reduces truncated 1,000-line JSON responses and repeated paid attempts.
DEFAULT_CHAR_BUDGET = 6500


def select_cloudflare_batch(remaining, originals):
    """Return the largest safe-ish next slice, up to 1,000 entries.

    `remaining` contains *pending indexes*, not a contiguous range. Each
    subtitle corresponds to exactly one JSON-array item in the response.
    Invalid/missing outputs still use the existing targeted retry/resume path.
    """
    if not remaining:
        return []
    budget = DEFAULT_CHAR_BUDGET
    max_lines = MAX_CF_LINES
    selected = []
    total_chars = 0
    for index in remaining:
        length = len(originals[index])
        if selected and (len(selected) >= max_lines or total_chars + length > budget):
            break
        selected.append(index)
        total_chars += length
    return selected
