"""Local term protection for EUMF SubNexa.

No external calls or persistence. Glossaries arrive with each translation request.
Protect source mentions before AI passes and restore after review. Reject results
where a token was lost, duplicated or moved to another subtitle entry.
"""
from __future__ import annotations

from collections import Counter
import hashlib
import json
import re

MAX_RULES = 200
MAX_JSON_BYTES = 128_000
TOKEN_RE = re.compile(r"\[\[SNX_\d{4}\]\]")
_RESERVED_TOKEN = re.compile(r"\[\[SNX_\d+\]\]", re.IGNORECASE)
VALID_MODES = {"never_translate", "custom_translation"}


def parse_glossary(raw):
    """Return canonical list of rules; reject malformed or ambiguous input."""
    if raw is None or raw == "":
        return []
    if isinstance(raw, str):
        if len(raw.encode("utf-8")) > MAX_JSON_BYTES:
            raise ValueError("Glossary JSON exceeds 128 KB.")
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError("Glossary must be a valid JSON array.") from exc
    if not isinstance(raw, list):
        raise ValueError("Glossary must be a JSON array.")
    if len(raw) > MAX_RULES:
        raise ValueError(f"Glossary supports at most {MAX_RULES} entries.")
    normalized = []
    seen = set()
    for num, obj in enumerate(raw, 1):
        if not isinstance(obj, dict):
            raise ValueError(f"Glossary rule {num} must be an object.")
        source = obj.get("source")
        target = obj.get("target", "")
        mode = obj.get("mode", "never_translate")
        sensitive = obj.get("case_sensitive", False)
        if not isinstance(source, str) or not source.strip() or len(source) > 100:
            raise ValueError(f"Rule {num}: source must be 1–100 characters.")
        if not isinstance(target, str) or len(target) > 120:
            raise ValueError(f"Rule {num}: target must be at most 120 characters.")
        if mode not in VALID_MODES:
            raise ValueError(f"Rule {num}: unsupported rule mode.")
        if not isinstance(sensitive, bool):
            raise ValueError(f"Rule {num}: case_sensitive must be a boolean.")
        source = source.strip()
        target = target.strip()
        if mode == "custom_translation" and not target:
            raise ValueError(f"Rule {num}: custom translation cannot be empty.")
        if any(ch in source + target for ch in ("\r", "\n", "\x00")):
            raise ValueError(f"Rule {num}: newline or null in term.")
        if _RESERVED_TOKEN.search(source + target):
            raise ValueError(f"Rule {num}: reserved placeholder pattern not permitted.")
        key = source.casefold()
        if key in seen:
            raise ValueError(f"Rule {num}: duplicate source term '{source}'.")
        seen.add(key)
        normalized.append({
            "source": source,
            "target": target if mode == "custom_translation" else "",
            "mode": mode,
            "case_sensitive": sensitive,
        })
    return sorted(normalized, key=lambda r: (r["source"].casefold(), r["source"]))


def glossary_fingerprint(rules):
    payload = json.dumps(rules, ensure_ascii=False, sort_keys=True,
                         separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def _candidate_matches(text, rules):
    candidates = []
    for rule in rules:
        pattern = re.compile(r"(?<!\w)" + re.escape(rule["source"]) + r"(?!\w)",
                             0 if rule["case_sensitive"] else re.IGNORECASE)
        for match in pattern.finditer(text):
            candidates.append((match.start(), match.end(), rule))
    # Longest wins at each position; if positions overlap, first accepted wins.
    candidates.sort(key=lambda hit: (hit[0], -(hit[1] - hit[0]), hit[2]["source"]))
    selected = []
    end = 0
    for start, stop, rule in candidates:
        if start < end:
            continue
        selected.append((start, stop, rule))
        end = stop
    return selected


def mask_batch(texts, rules):
    """Return masked strings and per-line maps token -> intended output."""
    if not rules:
        return list(texts), [{} for _ in texts]
    masked = []
    maps = []
    next_id = 1
    for text in texts:
        if _RESERVED_TOKEN.search(text):
            raise ValueError("Source SRT already contains a reserved SNX placeholder.")
        parts = []
        mapping = {}
        cursor = 0
        for start, stop, rule in _candidate_matches(text, rules):
            if next_id > 9999:
                raise ValueError("Too many glossary term occurrences in one batch.")
            token = f"[[SNX_{next_id:04d}]]"
            next_id += 1
            parts.extend((text[cursor:start], token))
            mapping[token] = (text[start:stop] if rule["mode"] == "never_translate"
                              else rule["target"])
            cursor = stop
        parts.append(text[cursor:])
        masked.append("".join(parts))
        maps.append(mapping)
    return masked, maps


def tokens_intact(text, mapping):
    expected = Counter(mapping.keys())
    found = Counter(TOKEN_RE.findall(text))
    return found == expected


def restore_line(text, mapping):
    if not tokens_intact(text, mapping):
        raise ValueError("AI changed, moved or omitted a protected glossary token.")
    for token, value in mapping.items():
        text = text.replace(token, value)
    return text


def preview_glossary(text, rules):
    masked, maps = mask_batch([text], rules)
    return {
        "source": text,
        "masked": masked[0],
        "replacements": [{"placeholder": token, "restored": value}
                         for token, value in maps[0].items()],
        "restored_example": restore_line(masked[0], maps[0]),
        "note": "This is a local placeholder simulation, not an AI translation.",
    }


def recover_tokens(text, mapping):
    """Recover only unambiguous exact glossary outputs or formatted token IDs.

    Never insert missing words or accept another entry's placeholders. Failure
    returns the original output so existing strict validation still rejects it.
    """
    if not isinstance(text, str) or not mapping or tokens_intact(text, mapping):
        return text
    original = text
    # Whitespace/case changes inside a known marker do not change its identity.
    def canonical(match):
        token = "[[SNX_" + match.group(1).zfill(4) + "]]"
        return token if token in mapping else match.group(0)
    text = re.sub(r"\[\[\s*SNX\s*_\s*(\d{1,4})\s*\]\]", canonical,
                  text, flags=re.IGNORECASE)
    found = Counter(TOKEN_RE.findall(text))
    if any(token not in mapping or count != 1 for token, count in found.items()):
        return original
    missing = [token for token in mapping if token not in found]
    # Identical/overlapping targets cannot be assigned safely to individual IDs.
    targets = list(mapping.values())
    for token in missing:
        value = mapping[token]
        if not value or sum(value in other or other in value for other in targets) != 1:
            return original
        pattern = re.compile(r"(?<!\w)" + re.escape(value) + r"(?!\w)")
        hits = list(pattern.finditer(text))
        if len(hits) != 1:
            return original
        text = pattern.sub(lambda _: token, text, count=1)
    return text if tokens_intact(text, mapping) else original
