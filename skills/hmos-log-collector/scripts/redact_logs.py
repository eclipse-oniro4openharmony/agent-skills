#!/usr/bin/env python3
"""Create a text-focused, heuristic-redacted copy of a log evidence bundle."""

from __future__ import annotations

import argparse
import re
import shutil
from pathlib import Path

PATTERNS = [
    (re.compile(r"(?i)(bearer\s+)[A-Za-z0-9._~+/=-]+"), r"\1[REDACTED]"),
    (re.compile(r"(?i)((?:token|password|passwd|secret|api[_-]?key)\s*[=:]\s*)[^\s,;]+"), r"\1[REDACTED]"),
    (re.compile(r"(?i)(cookie\s*[=:]\s*)[^\r\n]+"), r"\1[REDACTED]"),
    (re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE), "[REDACTED_EMAIL]"),
    (re.compile(r"(?<!\d)\+?\d{10,15}(?!\d)"), "[REDACTED_PHONE]"),
    (re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b"), "[REDACTED_IP]"),
    (re.compile(r"(?i)(?:[A-Z]:\\Users\\)[^\\\r\n \"']+"), "[REDACTED_WINDOWS_PATH]"),
    (re.compile(r"(?<![A-Za-z0-9])/(?:Users|home|data|private)/[^\r\n \"']+"), "[REDACTED_PATH]"),
]


def redact_text(value: str) -> str:
    result = value
    for pattern, replacement in PATTERNS:
        result = pattern.sub(replacement, result)
    return result


def is_probably_text(path: Path) -> bool:
    try:
        sample = path.read_bytes()[:4096]
    except OSError:
        return False
    return b"\x00" not in sample


def redact_tree(source: Path, destination: Path) -> int:
    if not source.is_dir():
        raise ValueError(f"Input directory does not exist: {source}")
    destination.mkdir(parents=True, exist_ok=False)
    changed = 0
    for item in source.rglob("*"):
        relative = item.relative_to(source)
        target = destination / relative
        if item.is_dir():
            target.mkdir(parents=True, exist_ok=True)
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        if is_probably_text(item):
            try:
                text = item.read_text(encoding="utf-8", errors="replace")
                target.write_text(redact_text(text), encoding="utf-8", newline="")
                changed += 1
                continue
            except OSError:
                pass
        shutil.copy2(item, target)
    return changed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    if args.output.exists():
        parser.error(f"Output directory already exists: {args.output}")
    changed = redact_tree(args.input, args.output)
    print(f"Redacted {changed} text files into {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
