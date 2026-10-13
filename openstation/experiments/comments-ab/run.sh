#!/usr/bin/env bash
# Comments A/B runner: runs the same prompt N times on each of two branches
# in fresh clones, records tokens/time/cost per run, runs the project's
# gates, and stores a blind-labelled diff for the judge.
#
# Usage:  ./run.sh                      (defaults below)
#         TASK=keep-on-top RUNS=1 MODEL=claude-opus-5-5 EFFORT=high ./run.sh
#
# Env:    TASK      folder under tasks/ holding prompt.md, rubric.md and an
#                   optional hidden.test.ts (copied in after the agent is done,
#                   run as the `hidden` gate, removed before the diff)
#         MAIN      path to the main checkout (branches + node_modules + vendor)
#         ARM_A/B   the two branches to compare (resolved to a commit ONCE, at
#                   start, so a branch moving mid-run cannot change the base)
#         ARM_A_AT/ARM_B_AT  pin an arm to a commit while keeping the branch
#                   name for the report (e.g. ARM_A=trunk ARM_A_AT=644a9976)
#         RUNS      runs per arm (default 3)
#         FIRST_RUN run index to start at (default 1; with APPEND=1 this adds
#                   runs to an existing results dir)
#         LABELS    space-separated blind labels to draw from (default R01..R2N;
#                   required with APPEND=1 so new labels don't collide)
#         APPEND=1  allow OUT to exist; appends to key/metrics/config
#         MODEL     passed to `claude --model` when set
#         EFFORT    passed to `claude --effort` when set
#         GATE_BUILD=1  also run `npm run build` as a gate (slow)
#         OUT       results dir (default ./results/<task>-<timestamp>)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
TASK="${TASK:-tile-all-windows}"
TASK_DIR="$HERE/tasks/$TASK"
[ -f "$TASK_DIR/prompt.md" ] || { echo "no prompt at $TASK_DIR/prompt.md" >&2; exit 1; }
MAIN="${MAIN:-$HOME/github/alcazaba-plugin}"
ARM_A="${ARM_A:-trunk}"
ARM_B="${ARM_B:-codex/remove-code-comments}"
ARM_A_SHA="$(git -C "$MAIN" rev-parse "${ARM_A_AT:-$ARM_A}")"
ARM_B_SHA="$(git -C "$MAIN" rev-parse "${ARM_B_AT:-$ARM_B}")"
RUNS="${RUNS:-3}"
FIRST_RUN="${FIRST_RUN:-1}"
LAST_RUN=$(( FIRST_RUN + RUNS - 1 ))
APPEND="${APPEND:-0}"
MODEL="${MODEL:-}"
EFFORT="${EFFORT:-}"
GATE_BUILD="${GATE_BUILD:-0}"
OUT="${OUT:-$HERE/results/$TASK-$(date +%Y%m%d-%H%M%S)}"
WT_ROOT="${WT_ROOT:-${TMPDIR:-/tmp}/comments-ab-wt}"
PROMPT="$(cat "$TASK_DIR/prompt.md")"
HIDDEN_TEST="$TASK_DIR/hidden.test.ts"

# What the agent under test may run without a prompt. Edits are auto-accepted
# (acceptEdits); any Bash command outside this list is simply denied, the same
# way in both arms. Widen it if a run's agent.stderr shows a denied command it
# genuinely needed.
AGENT_TOOLS=(
	"Bash(npm run *)" "Bash(npx vitest*)" "Bash(npx tsc*)" "Bash(npx eslint*)"
	"Bash(vendor/bin/phpcs*)" "Bash(php -l*)"
	"Bash(git diff*)" "Bash(git status*)" "Bash(git log*)" "Bash(git show*)" "Bash(git grep*)"
	"Bash(git switch*)" "Bash(git checkout -b*)" "Bash(git branch*)" "Bash(git add*)" "Bash(git commit*)"
	"Bash(ls*)" "Bash(wc*)" "Bash(grep*)" "Bash(rg*)" "Bash(find*)"
	"Bash(head*)" "Bash(tail*)" "Bash(cat*)" "Bash(sed -n*)" "Bash(echo*)" "Bash(diff*)"
)

if [ -e "$OUT/key.csv" ] && [ "$APPEND" != 1 ]; then
	echo "$OUT already holds results; set APPEND=1 (and LABELS) to add runs" >&2; exit 1
fi
mkdir -p "$OUT/runs" "$WT_ROOT"
if [ "$APPEND" = 1 ] && [ -e "$OUT/key.csv" ]; then
	[ -n "${LABELS:-}" ] || { echo "APPEND=1 needs LABELS, e.g. LABELS='R04 R07'" >&2; exit 1; }
	cat >> "$OUT/config.txt" <<CFG
append=$(date -Iseconds) runs=$FIRST_RUN..$LAST_RUN
arm_A=$ARM_A @ $(git -C "$MAIN" rev-parse --short "$ARM_A_SHA")
arm_B=$ARM_B @ $(git -C "$MAIN" rev-parse --short "$ARM_B_SHA")
CFG
else
	echo "label,arm,branch,run,base_commit" > "$OUT/key.csv"
	echo "label,arm,wall_s,duration_ms,duration_api_ms,num_turns,cost_usd,input_tokens,output_tokens,cache_read_tokens,cache_create_tokens,is_error" > "$OUT/metrics.csv"
	cat > "$OUT/config.txt" <<CFG
task=$TASK
date=$(date -Iseconds)
claude=$(claude --version)
arm_A=$ARM_A @ $(git -C "$MAIN" rev-parse --short "$ARM_A_SHA")
arm_B=$ARM_B @ $(git -C "$MAIN" rev-parse --short "$ARM_B_SHA")
runs=$RUNS model=${MODEL:-default} effort=${EFFORT:-default} gate_build=$GATE_BUILD
CFG
fi

# Shuffled labels so the judge cannot infer the arm from the name.
LABEL_POOL="${LABELS:-$(seq -f 'R%02g' $(( (FIRST_RUN - 1) * 2 + 1 )) $(( LAST_RUN * 2 )) | tr '\n' ' ')}"
LABELS=()
while IFS= read -r l; do LABELS+=( "$l" ); done < <(
	tr ' ' '\n' <<< "$LABEL_POOL" | sed '/^$/d' | awk 'BEGIN{srand()}{printf "%f\t%s\n", rand(), $0}' | sort | cut -f2
)
[ "${#LABELS[@]}" -ge $(( RUNS * 2 )) ] || { echo "need $(( RUNS * 2 )) labels, got ${#LABELS[@]}" >&2; exit 1; }

run_one() {
	local arm="$1" branch="$2" sha="$3" run="$4" label="$5"
	local wt="${WT_ROOT:?}/${label:?}" dir="$OUT/runs/$label"
	[ -e "$dir" ] && { echo "run dir $dir already exists" >&2; exit 1; }
	mkdir -p "$dir"
	echo "== [$label] arm $arm ($branch) run $run"

	# A shared clone, not a worktree: a worktree shares refs with the main
	# checkout, so a branch the agent creates lands in the main repo and has to
	# be deleted afterwards, which once tripped over a branch the user had
	# created mid-run. A clone keeps everything the agent does to itself.
	rm -rf "${wt:?}"
	git clone --quiet --shared --no-checkout "$MAIN" "$wt"
	git -C "$wt" checkout --quiet --detach "$sha"
	rsync -a --link-dest="$MAIN/node_modules/" "$MAIN/node_modules/" "$wt/node_modules/"
	ln -s "$MAIN/vendor" "$wt/vendor"
	local base; base="$(git -C "$wt" rev-parse HEAD)"
	echo "$label,$arm,$branch,$run,$base" >> "$OUT/key.csv"

	local start end
	start="$(date +%s)"
	(
		cd "$wt"
		claude -p "$PROMPT" \
			--output-format json \
			--permission-mode acceptEdits \
			--allowedTools "${AGENT_TOOLS[@]}" \
			--no-session-persistence \
			--setting-sources project \
			${MODEL:+--model "$MODEL"} \
			${EFFORT:+--effort "$EFFORT"} \
			> "$dir/agent.json" 2> "$dir/agent.stderr"
	) || echo "$?" > "$dir/agent.exit"
	end="$(date +%s)"

	jq -r --arg label "$label" --arg arm "$arm" --arg wall "$(( end - start ))" '
		[ $label, $arm, $wall,
		  (.duration_ms // 0), (.duration_api_ms // 0), (.num_turns // 0),
		  (.total_cost_usd // 0),
		  (.usage.input_tokens // 0), (.usage.output_tokens // 0),
		  (.usage.cache_read_input_tokens // 0), (.usage.cache_creation_input_tokens // 0),
		  (.is_error // false) ] | @csv' "$dir/agent.json" >> "$OUT/metrics.csv" \
		|| echo "\"$label\",\"$arm\",$(( end - start )),0,0,0,0,0,0,0,0,true" >> "$OUT/metrics.csv"

	# Both branches are green before the agent touches them, so a gate is simply
	# the project's own command exiting 0 after the agent is done.
	gate() {
		local name="$1"; shift
		if ( cd "$wt" && "$@" > "$dir/gate-$name.log" 2>&1 ); then
			echo "$name,pass" >> "$dir/gates.csv"
		else
			echo "$name,fail" >> "$dir/gates.csv"
		fi
	}
	: > "$dir/gates.csv"
	gate lint      npm run lint
	gate typecheck npm run typecheck
	gate test_js   npm run test:js
	gate phpcs     vendor/bin/phpcs -n
	if [ "$GATE_BUILD" = 1 ]; then gate build npm run build; fi

	# Hidden behavioural test: dropped in only after the other gates ran (so it
	# can't fail typecheck on the agent's behalf), run on its own, removed again
	# before the diff is taken. hidden.txt keeps the per-case lines for the judge.
	if [ -f "$HIDDEN_TEST" ]; then
		local hidden_rel="tests/vitest/zz-hidden-$TASK.test.ts"
		cp "$HIDDEN_TEST" "$wt/$hidden_rel"
		gate hidden npx vitest run "$hidden_rel" --reporter=verbose
		grep -E '✓|×|✗|Tests |Error' "$dir/gate-hidden.log" | sed 's/\x1b\[[0-9;]*m//g' > "$dir/hidden.txt" || true
		rm -f "${wt:?}/${hidden_rel:?}"
	fi

	# Diff against the base commit so an agent that committed (or branched) is
	# captured the same as one that left its edits in the working tree.
	git -C "$wt" add -A -N > /dev/null 2>&1 || true
	git -C "$wt" status --short > "$dir/status.txt"
	git -C "$wt" log --oneline "$base..HEAD" > "$dir/commits.txt" 2>/dev/null || true
	git -C "$wt" diff --stat "$base" > "$dir/diff.stat"
	git -C "$wt" diff -U3 "$base"    > "$dir/diff.patch"
	git -C "$wt" diff -U0 "$base"    > "$dir/diff-blind.patch"

	rm -rf "${wt:?}"
	echo "   done in $(( end - start ))s; gates: $(paste -sd' ' - < "$dir/gates.csv")"
}

# Alternate arms so time-of-day and rate-limit effects spread evenly.
i=0
for run in $(seq "$FIRST_RUN" "$LAST_RUN"); do
	run_one A "$ARM_A" "$ARM_A_SHA" "$run" "${LABELS[$i]}"; i=$(( i + 1 ))
	run_one B "$ARM_B" "$ARM_B_SHA" "$run" "${LABELS[$i]}"; i=$(( i + 1 ))
done

echo
echo "Results in $OUT"
echo "Next: ./judge.sh $OUT   then   python3 -I summarize.py $OUT"
