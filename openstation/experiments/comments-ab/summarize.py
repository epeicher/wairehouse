#!/usr/bin/env python3
"""Join key.csv + metrics.csv + runs/*/scores.json and print per-arm means."""
import csv
import json
import statistics
import sys
from pathlib import Path

out = Path(sys.argv[1])
# Optional: criteria to leave out of the score, e.g. `--without F` when one
# arm has no docs to update and F would be lost by construction.
without = set()
if "--without" in sys.argv:
    without = set(sys.argv[sys.argv.index("--without") + 1].split(","))
key = {r["label"]: r for r in csv.DictReader(open(out / "key.csv"))}
metrics = {r["label"]: r for r in csv.DictReader(open(out / "metrics.csv"))}

rows = []
for label, k in sorted(key.items()):
    m = metrics.get(label, {})
    scores_file = out / "runs" / label / "scores.json"
    score = None
    if scores_file.exists():
        try:
            # Sum the per-criterion scores; judges have mis-added `total`.
            scores = json.load(open(scores_file))["scores"]
            score = sum(v for k, v in scores.items() if k not in without)
        except Exception:
            pass
    gates = {}
    gf = out / "runs" / label / "gates.csv"
    if gf.exists():
        for line in gf.read_text().splitlines():
            name, verdict = line.split(",")
            gates[name] = verdict
    rows.append({
        "label": label, "arm": k["arm"], "branch": k["branch"],
        "score": score,
        "gates_passed": sum(v == "pass" for v in gates.values()),
        "gates_total": len(gates),
        "wall_s": float(m.get("wall_s") or 0),
        "turns": int(m.get("num_turns") or 0),
        "cost": float(m.get("cost_usd") or 0),
        "in": int(m.get("input_tokens") or 0),
        "out": int(m.get("output_tokens") or 0),
        "cache_read": int(m.get("cache_read_tokens") or 0),
        "cache_create": int(m.get("cache_create_tokens") or 0),
        "error": m.get("is_error", ""),
    })

print(f"{'label':6} {'arm':3} {'score':>5} {'gates':>5} {'wall_s':>7} {'turns':>5} "
      f"{'cost$':>7} {'in':>8} {'out':>7} {'cache_rd':>10} {'cache_cr':>9} err")
for r in rows:
    s = "-" if r["score"] is None else r["score"]
    print(f"{r['label']:6} {r['arm']:3} {s!s:>5} {r['gates_passed']}/{r['gates_total']:<3} "
          f"{r['wall_s']:7.0f} {r['turns']:5d} {r['cost']:7.2f} {r['in']:8d} {r['out']:7d} "
          f"{r['cache_read']:10d} {r['cache_create']:9d} {r['error']}")


def mean(xs):
    xs = [x for x in xs if x is not None]
    return statistics.mean(xs) if xs else float("nan")


def sd(xs):
    xs = [x for x in xs if x is not None]
    return statistics.stdev(xs) if len(xs) > 1 else 0.0


print()
print(f"{'arm':3} {'branch':34} {'n':>2} {'score':>11} {'wall_s':>13} {'turns':>9} "
      f"{'cost$':>11} {'total_tokens':>22}")
for arm in ("A", "B"):
    g = [r for r in rows if r["arm"] == arm]
    if not g:
        continue
    tot = [r["in"] + r["out"] + r["cache_read"] + r["cache_create"] for r in g]
    print(f"{arm:3} {g[0]['branch']:34} {len(g):2d} "
          f"{mean([r['score'] for r in g]):5.1f}±{sd([r['score'] for r in g]):<5.1f} "
          f"{mean([r['wall_s'] for r in g]):6.0f}±{sd([r['wall_s'] for r in g]):<6.0f} "
          f"{mean([r['turns'] for r in g]):4.0f}±{sd([r['turns'] for r in g]):<4.0f} "
          f"{mean([r['cost'] for r in g]):5.2f}±{sd([r['cost'] for r in g]):<5.2f} "
          f"{mean(tot):11.0f}±{sd(tot):<10.0f}")
print("\n(total_tokens = input + output + cache read + cache create; "
      "cost is Claude Code's list-price estimate"
      + (f"; score excludes {','.join(sorted(without))}" if without else "") + ")")
