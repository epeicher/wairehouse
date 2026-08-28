# Repo-settings hardening plan (follow-up to the CI security audit)

Status: complete. These are GitHub settings changes (admin console / API), not
code, surfaced by the CI pipeline security audit done on PR #425. Everything
here is idempotent and reversible; suggested order is top to bottom.

Applied on 2026-08-28: steps 1, 2, 3 and 6 (step 3 is ruleset 21726771,
"Release tags", bypass = Maintain + Admin repository roles). Step 4 was
decided, not changed: zero required reviews stays, on purpose. Step 5.1 and
step 7 are the pinning PR, which also pins `actions/checkout` and
`actions/github-script` in `pr-preview-publish.yml` (unpinned too, and it
would break under step 5.2). Step 5.2 was applied after that PR (#698) merged
and then **reverted the same day** — see "The transitive-dependency trap"
below. Final state: steps 1, 2, 3, 5.1, 6 and 7 applied; step 4 decided; step
5.2 abandoned as unusable.

## The transitive-dependency trap (read before re-enabling 5.2 or editing 6)

**Both `sha_pinning_required` and `allowed_actions` are enforced transitively,
into the nested `uses:` of third-party composite actions we do not control.**
The rules are evaluated at "Set up job", before any step runs, so the job list
comes back empty and the only evidence is one annotation on the run.

Two workflows broke this way, neither of which had changed:

- **`pr-preview-publish.yml`**, by step 5.2.
  `WordPress/action-wp-playground-pr-preview/.github/actions/expose-artifact-on-public-url`
  does `uses: actions/download-artifact@v4` in its own `action.yml`. GitHub-
  owned, so the allow-list permits it, but it is a tag. Unfixable from this
  repo without forking upstream, which is why 5.2 was abandoned.
- **`claude.yml`**, by step 6. `anthropics/claude-code-action` does
  `uses: oven-sh/setup-bun@0c5077e5…`, already SHA-pinned but from an owner
  that was not in the patterns. Fixed by adding `oven-sh/setup-bun@*`.

Two things make this hard to notice:

1. Neither workflow is `pull_request`-triggered (`workflow_run` and
   `issue_comment`), so neither runs during a PR and neither appears on a PR's
   checks tab. The Actions tab is the only place they surface.
2. `claude.yml` only executes on an `@claude` mention; every run in between was
   `skipped`, so step 6 broke it silently and it stayed broken until someone
   invoked the bot.

**So auditing the top-level `uses:` in `.github/workflows/` is not sufficient.**
Before adding a pattern-based restriction, read the `action.yml` of every
third-party action in use and enumerate its nested `uses:` too. A green
`trunk-build.yml` run proves nothing here: it only uses `actions/checkout` and
`actions/setup-node`. `release.yml` is safe for a different reason, the 10up
deploy action is a Docker action with no nested `uses:` at all.

**Current settings after the revert:** `allowed_actions: selected`,
`sha_pinning_required: false`, patterns = the four above plus
`oven-sh/setup-bun@*`. Our own workflows remain SHA-pinned in code from #698;
that is the protection that matters. The lost piece is enforcement against
future drift in our own files, which a repo-side CI check could restore
without reaching into upstream actions.

## 1. Default workflow token: write → read, and no PR approvals

**Current:** `default_workflow_permissions: write`,
`can_approve_pull_request_reviews: true`.
**Risk:** every workflow in the repo currently declares an explicit
`permissions:` block, so nothing is exposed today; but any future workflow
that forgets the block silently gets a write token, and Actions being able to
approve PRs is a known privilege-escalation building block.
**Change:**

```bash
gh api -X PUT repos/WordPress/openstation/actions/permissions/workflow \
  -f default_workflow_permissions=read \
  -F can_approve_pull_request_reviews=false
```

**Tradeoff:** none today. New workflows must state what they need, which is
the behavior we want anyway.
**Verify:** `gh api repos/WordPress/openstation/actions/permissions/workflow`.

## 2. Fork PR workflow approval: require for all outside collaborators

**Current:** `approval_policy: first_time_contributors_new_to_github` (only
brand-new GitHub accounts wait for approval).
**Risk:** any aged account that opens a PR gets CI to build it AND gets the
built zip published publicly on the `ci-artifacts` release by
`pr-preview-publish.yml`; with OpenStation Beta those artifacts are one click
from running server-side on a test site.
**Change:** Settings → Actions → General → "Fork pull request workflows from
outside collaborators" → **Require approval for all outside collaborators**.
**Tradeoff:** community PRs get no preview build (and no Beta-installable
artifact) until a maintainer approves the run. That friction is the control.
**Verify:**
`gh api repos/WordPress/openstation/actions/permissions/fork-pr-contributor-approval`.

## 3. Tag ruleset protecting `v*`

**Current:** the trunk branch has a ruleset (PRs required, squash-only, four
required status checks); tags have none. A `v*` tag push triggers
`release.yml`, which builds, publishes a GitHub release, and deploys to
WordPress.org with the SVN secrets — so today, tag-push rights equal
release-and-deploy rights for anyone with write access.
**Change:** new repository ruleset targeting tags `v*`: restrict creation,
update, and deletion to the Maintain/Admin roles (or a release team).
Console: Settings → Rules → Rulesets → New tag ruleset.
**Tradeoff:** releases become maintainer-only, which matches
`bin/release.sh` usage in practice.

## 4. Consider requiring one approving review on trunk

**Current:** the trunk ruleset has `required_approving_review_count: 0`
(PR + green checks required, review not).
**Note:** with a small team this may be deliberate; recording the decision is
the point. If review is wanted: edit ruleset 15444243, set required approvals
to 1. Keep `require_extra_approval_for_unattributed_changes: true` (already
on).
**Decision (2026-08-28):** keep `required_approving_review_count: 0`. This is
deliberate, not an omission: the team wants to be able to merge PRs that have
not been reviewed. Revisit only if the team grows.

## 5. Require SHA pinning for actions (after finishing the pinning pass)

**Current:** `sha_pinning_required: false`; privileged workflows
(`release.yml`, `wiki.yml`, `claude.yml`, `trunk-build.yml` after PR #425's
hardening commit, plus the third-party preview actions) are SHA-pinned, but
`ci.yml` and `pr-preview-build.yml` still use version tags
(`actions/checkout@v7.0.1`, `actions/setup-node@v7`,
`actions/upload-artifact@v7`).
**Change, two steps:**
1. Code PR: pin the remaining tags in `ci.yml` and `pr-preview-build.yml` to
   the same SHAs `release.yml` uses.
2. Then flip the knob (`allowed_actions=selected`, not `all`: step 6 is
   applied, and this PUT would otherwise reset it):

```bash
gh api -X PUT repos/WordPress/openstation/actions/permissions \
  -F enabled=true -f allowed_actions=selected -F sha_pinning_required=true
```

**Tradeoff:** Dependabot/renovate-style bumps become SHA bumps; that is the
supply-chain protection working.

## 6. Optional: restrict `allowed_actions`

**Current:** `allowed_actions: all`. The set actually used is small:
`actions/*`, `WordPress/action-wp-playground-pr-preview`,
`anthropics/claude-code-action`, `10up/action-wordpress-plugin-deploy`.
**Change:** Settings → Actions → General → "Allow select actions": GitHub-owned
plus that explicit list. **Tradeoff:** adding a new action needs a settings
edit; skip if that friction outweighs the benefit for this team.
**Applied (2026-08-28):** `allowed_actions: selected`, `github_owned_allowed:
true`, `patterns_allowed`: `WordPress/action-wp-playground-pr-preview@*`,
`WordPress/action-wp-playground-pr-preview/*` (the second form covers the
`.github/actions/expose-artifact-on-public-url` subpath),
`anthropics/claude-code-action@*`, `10up/action-wordpress-plugin-deploy@*`.
Adding an action now means a PUT to
`repos/WordPress/openstation/actions/permissions/selected-actions` with the
full list (it replaces, not appends).

## 7. Small code parity nit (goes with step 5's code PR)

`pr-preview-build.yml` checkout lacks `persist-credentials: false` (ci.yml
sets it everywhere, with a comment explaining why). The token there is
read-only for forks, so this is parity rather than a live hole.

## Verification checklist after all steps

```bash
gh api repos/WordPress/openstation/actions/permissions/workflow
gh api repos/WordPress/openstation/actions/permissions/fork-pr-contributor-approval
gh api repos/WordPress/openstation/actions/permissions
gh api repos/WordPress/openstation/rules/branches/trunk
gh api 'repos/WordPress/openstation/rulesets?includes_parents=false'
```
