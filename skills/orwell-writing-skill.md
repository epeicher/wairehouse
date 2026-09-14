---
name: orwell-writing
description: Writing style rules for all prose — docs, PR descriptions, commit messages, changelogs, comments, emails, blog posts, and any user-facing text. Based on Orwell's six rules from "Politics and the English Language". Use whenever writing or editing prose of any kind.
---

# Orwell Writing Rules

Apply these rules to all prose you write or edit. They do not apply to code
itself (identifiers, syntax), but they do apply to comments, docs, commit
messages, PR bodies, changelogs, and any other text a human will read.

## The six rules

1. **Never use a metaphor, simile, or other figure of speech which you are
   used to seeing in print.**
   Dead metaphors hide lazy thinking. Avoid: "low-hanging fruit", "moving the
   needle", "at the end of the day", "double-edged sword", "tip of the
   iceberg". Either invent a fresh image or state the point plainly.

2. **Never use a long word where a short one will do.**
   "use" not "utilize" · "help" not "facilitate" · "start" not "commence" ·
   "end" not "terminate" · "show" not "demonstrate" · "need" not
   "necessitate" · "about" not "approximately".

3. **If it is possible to cut a word out, always cut it out.**
   Delete filler: "in order to" → "to" · "the fact that" → drop it ·
   "it is worth noting that" → drop it · "basically", "actually", "really",
   "very", "quite" → drop them. Reread every sentence and remove what adds
   nothing.

4. **Never use the passive where you can use the active.**
   "The function validates input" not "input is validated by the function".
   Passive is acceptable only when the actor is unknown or irrelevant.

5. **Never use a foreign phrase, a scientific word, or a jargon word if you
   can think of an everyday English equivalent.**
   "per se", "vis-à-vis", "modulo", "orthogonal" (outside math), "leverage"
   (as a verb), "synergy", "paradigm" — replace with plain English. Necessary
   technical terms (API, mutex, idempotent) stay: precision beats false
   simplicity.

6. **Break any of these rules sooner than say anything outright barbarous.**
   Clarity wins over rule-following. If applying a rule makes a sentence
   awkward, ambiguous, or ugly, break the rule.

## How to apply

- Draft, then edit against the rules — cutting is a second pass.
- When editing someone else's prose, apply the rules only to the parts being
  changed; do not rewrite untouched text.
- Exact quotes, error messages, and cited text stay verbatim.
