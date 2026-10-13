#!/usr/bin/env bash
# Blind judge: scores every run under <results>/runs/R* with rubric.md.
# It never reads key.csv or metrics.csv, only the run's gates, final message
# and the zero-context diff.
#
# Usage:  ./judge.sh results/<timestamp>
#         JUDGE_MODEL=claude-opus-4-6 ./judge.sh results/<timestamp>
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$(cd "${1:?results dir}" && pwd)"
JUDGE_MODEL="${JUDGE_MODEL:-}"
# The task is recorded by run.sh; older result dirs predate that line.
TASK="${TASK:-$(sed -n 's/^task=//p' "$OUT/config.txt" 2> /dev/null)}"
TASK="${TASK:-tile-all-windows}"
RUBRIC="$HERE/tasks/$TASK/rubric.md"
[ -f "$RUBRIC" ] || { echo "no rubric at $RUBRIC" >&2; exit 1; }
echo "task: $TASK (rubric $RUBRIC)"

for dir in "$OUT"/runs/R*; do
	label="$(basename "$dir")"
	if [ -s "$dir/scores.json" ]; then
		echo "== [$label] already scored, skipping"
		continue
	fi
	echo "== [$label] judging"
	prompt="$(
		cat "$RUBRIC"
		echo; echo "## Gate results (deterministic, run by the harness)"; echo
		cat "$dir/gates.csv"
		if [ -s "$dir/hidden.txt" ]; then
			echo; echo "## Hidden behavioural test (run by the harness after the agent finished; the agent never saw it)"; echo
			cat "$dir/hidden.txt"
		fi
		echo; echo "## Agent's final message"; echo
		jq -r '.result // "(no final message)"' "$dir/agent.json" 2> /dev/null || echo "(agent produced no JSON)"
		echo; echo "## Diff stat"; echo
		cat "$dir/diff.stat"
		echo; echo "## Diff (unified, zero context lines)"; echo
		cat "$dir/diff-blind.patch"
	)"
	(
		cd "$OUT"
		claude -p "$prompt" \
			--output-format json \
			--no-session-persistence \
			--setting-sources project \
			--tools "" \
			${JUDGE_MODEL:+--model "$JUDGE_MODEL"} \
			> "$dir/judge.json" 2> "$dir/judge.stderr"
	) || { echo "   judge failed, see $dir/judge.stderr"; continue; }
	# Pull the JSON object out of the reply, tolerating a code fence.
	jq -r '.result' "$dir/judge.json" | sed -e 's/^```json//' -e 's/^```//' | sed -n '/^{/,/^}/p' > "$dir/scores.json"
	if jq -e '.total' "$dir/scores.json" > /dev/null 2>&1; then
		echo "   total $(jq -r '.total' "$dir/scores.json")/$(jq -r '.max' "$dir/scores.json")"
	else
		echo "   could not parse scores, see $dir/judge.json"
	fi
done
echo
echo "Next: python3 -I summarize.py $OUT"
