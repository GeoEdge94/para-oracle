#!/usr/bin/env python3
"""
Helpers stdlib-only pour scripts/e2e_challenger.sh.

Execute a l'interieur du container backend (volume ./scripts:/scripts:ro)
pour disposer de python + acces reseau interne + acces a /data/ipfs-mock.

Dispatch par sous-commande :

  resolve  <url>              -> POST url ; print "outcome fp data_cid"
  pending  <url> <slug>       -> GET url ; print "data_cid fp" du slug
  tamper   <cid>              -> backup + flip observed_value dans /data/ipfs-mock/<cid>
  restore  <cid>              -> remplace /data/ipfs-mock/<cid> par <cid>.bak

Exit non-zero + message sur stderr si erreur.
"""
from __future__ import annotations
import json
import shutil
import sys
import urllib.request
from pathlib import Path

MOCK_IPFS = Path("/data/ipfs-mock")


def cmd_resolve(url: str) -> int:
    req = urllib.request.Request(url, method="POST")
    with urllib.request.urlopen(req, timeout=300) as r:
        d = json.load(r)
    ev = d["evidence"]
    print(d["resolved_outcome"], ev["fingerprint_sha256"], ev["data_cid"])
    return 0


def cmd_pending(url: str, slug: str) -> int:
    with urllib.request.urlopen(url, timeout=30) as r:
        d = json.load(r)
    items = [i for i in d.get("items", []) if i["bet_slug"] == slug]
    if not items:
        print(f"slug {slug!r} not in pending", file=sys.stderr)
        return 1
    it = items[0]
    print(it["data_cid"], it["fingerprint_sha256"])
    return 0


def cmd_tamper(cid: str) -> int:
    p = MOCK_IPFS / cid
    if not p.exists():
        print(f"missing {p}", file=sys.stderr)
        return 1
    shutil.copyfile(p, p.with_suffix(".bak"))
    d = json.loads(p.read_bytes())
    orig = d["result"]["observed_value"]
    d["result"]["observed_value"] = orig + 9999.0
    p.write_text(json.dumps(d, separators=(",", ":"), ensure_ascii=False))
    print(f"orig={orig} tampered={d['result']['observed_value']}")
    return 0


def cmd_restore(cid: str) -> int:
    p = MOCK_IPFS / cid
    bak = p.with_suffix(".bak")
    if bak.exists():
        shutil.move(str(bak), str(p))
        print("restored")
    else:
        print("no backup to restore")
    return 0


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2
    cmd, *args = argv[1:]
    if cmd == "resolve":
        return cmd_resolve(*args)
    if cmd == "pending":
        return cmd_pending(*args)
    if cmd == "tamper":
        return cmd_tamper(*args)
    if cmd == "restore":
        return cmd_restore(*args)
    print(f"unknown command {cmd!r}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
