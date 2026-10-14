#!/usr/bin/env python3
"""Prove the backend did not change, without git or GitHub.

Usage (run from the project root, the folder that contains your backend and, later, frontend/):
    python backend_snapshot.py snapshot    # before building the UI
    python backend_snapshot.py verify      # after building the UI

It records a SHA-256 hash of every file outside the folders listed in EXCLUDE_DIRS.
`verify` reports files that were added, changed or removed, and exits with code 1 if any.
"""
import hashlib
import json
import os
import sys
from pathlib import Path

EXCLUDE_DIRS = {
    ".git", "frontend", "node_modules", ".venv", "venv", "env", "__pycache__",
    ".next", ".mypy_cache", ".pytest_cache", ".idea", ".vscode", ".cursor",
}
SNAPSHOT_FILE = ".backend_snapshot.json"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def scan(root: Path) -> dict:
    result = {}
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for name in filenames:
            if name == SNAPSHOT_FILE:
                continue
            p = Path(dirpath) / name
            try:
                result[p.relative_to(root).as_posix()] = sha256(p)
            except OSError as e:
                print(f"skipped {p}: {e}", file=sys.stderr)
    return result


def main() -> int:
    if len(sys.argv) < 2 or sys.argv[1] not in {"snapshot", "verify"}:
        print(__doc__)
        return 2
    mode = sys.argv[1]
    root = Path(sys.argv[2] if len(sys.argv) > 2 else ".").resolve()
    snap_path = root / SNAPSHOT_FILE

    if mode == "snapshot":
        data = scan(root)
        snap_path.write_text(json.dumps(data, indent=0, sort_keys=True), encoding="utf-8")
        print(f"Snapshot saved: {len(data)} files hashed in {root}")
        return 0

    if not snap_path.exists():
        print("No snapshot found. Run: python backend_snapshot.py snapshot (before building).")
        return 2
    before = json.loads(snap_path.read_text(encoding="utf-8"))
    after = scan(root)
    added = sorted(set(after) - set(before))
    removed = sorted(set(before) - set(after))
    changed = sorted(k for k in before.keys() & after.keys() if before[k] != after[k])

    if not (added or removed or changed):
        print(f"OK: backend unchanged ({len(after)} files identical).")
        return 0
    print("DIFFERENCES FOUND outside frontend/:")
    for label, items in (("added", added), ("changed", changed), ("removed", removed)):
        for item in items:
            print(f"  {label}: {item}")
    print("If a listed file is a runtime log or cache the backend wrote on its own, check it. Otherwise undo the change.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
