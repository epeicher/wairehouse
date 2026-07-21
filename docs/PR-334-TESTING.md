# PR #334 — Testing with `reprint.phar`

Verifies that a `files-pull --only=<dir>` delta no longer deletes the selected
directory locally. Remote is never modified; the bug only deletes local copies.

## Setup

```bash
URL='https://your-site.example/?reprint-api'   # site with the reprint exporter active
SECRET='…'                                     # its HMAC secret
STATE=/tmp/pr334/state FS=/tmp/pr334/fs-root
mkdir -p "$STATE" "$FS"
```

## 1. BEFORE — build from trunk, reproduce the failure

```bash
git checkout origin/trunk -- packages/reprint-importer/src/import.php
composer build:phar

php reprint.phar preflight  "$URL" --secret="$SECRET" --state-dir="$STATE" --fs-root="$FS"
php reprint.phar files-pull "$URL" --secret="$SECRET" --state-dir="$STATE" --fs-root="$FS" --filter=essential-files
php reprint.phar files-pull "$URL" --secret="$SECRET" --state-dir="$STATE" --fs-root="$FS" --abort
php reprint.phar files-pull "$URL" --secret="$SECRET" --state-dir="$STATE" --fs-root="$FS" --filter=essential-files --only=:wp-plugins:

grep 'Deleted:' "$STATE/.import-audit.log"       # shows "Deleted: …/wp-content/plugins"
find "$FS" -type d -path '*wp-content/plugins'   # no output — directory was deleted
```

The `--abort` clears the completed-sync marker so the `--only` run performs a
delta diff. If a pull exits with code 2 (partial progress), rerun it until it
reports `files-pull complete`.

## 2. Apply the fix

```bash
git checkout HEAD -- packages/reprint-importer/src/import.php
composer build:phar
```

## 3. AFTER — same sequence on fresh dirs, no deletion

```bash
rm -rf "$STATE" "$FS" && mkdir -p "$STATE" "$FS"

php reprint.phar preflight  "$URL" --secret="$SECRET" --state-dir="$STATE" --fs-root="$FS"
php reprint.phar files-pull "$URL" --secret="$SECRET" --state-dir="$STATE" --fs-root="$FS" --filter=essential-files
php reprint.phar files-pull "$URL" --secret="$SECRET" --state-dir="$STATE" --fs-root="$FS" --abort
php reprint.phar files-pull "$URL" --secret="$SECRET" --state-dir="$STATE" --fs-root="$FS" --filter=essential-files --only=:wp-plugins:

grep 'Deleted:' "$STATE/.import-audit.log"       # no wp-content/plugins line
find "$FS" -type d -path '*wp-content/plugins'   # still present, refreshed
```
