#!/usr/bin/env bash
#
# Rebuilds docs/index.html for GitHub Pages.
#
# Scans every *.html in docs/ (except index.html itself), reads each file's
# <title>, and writes a styled index that links to them all. GitHub Pages serves
# docs/ at https://epeicher.github.io/wairehouse/ so the index lives at the root.
#
# Plans in docs/<subfolder>/ (e.g. docs/openstation/, docs/reprint/) are listed
# as their own labelled section; top-level docs/*.html (if any) come first.
#
# Run it after adding/removing a plan:   bash build-docs-index.sh
# (The Pages workflow also runs it on every push to docs/, then deploys the result.)
#
set -euo pipefail
cd "$(dirname "$0")"

DOCS="docs"
PAGES_URL="https://epeicher.github.io/wairehouse/"
mkdir -p "$DOCS"

CARDS=""
COUNT=0
while IFS= read -r f; do
  [ -n "$f" ] || continue
  title=$(grep -o '<title>[^<]*</title>' "$DOCS/$f" | head -1 | sed 's/<[^>]*>//g; s/^[[:space:]]*//; s/[[:space:]]*$//')
  [ -n "$title" ] || title="$f"
  bytes=$(wc -c < "$DOCS/$f")
  kb=$(( (bytes + 1023) / 1024 ))
  date=$(git log -1 --format=%ad --date=short -- "$DOCS/$f" 2>/dev/null || true)
  [ -n "$date" ] || date=$(date '+%Y-%m-%d')
  CARDS+="      <a class=\"card\" href=\"./${f}\">
        <div class=\"ct\">${title}</div>
        <div class=\"cf\">${f}</div>
        <div class=\"cm\">${kb} KB &middot; ${date}</div>
        <span class=\"go\">Open &#8599;</span>
      </a>
"
  COUNT=$((COUNT + 1))
done < <( (cd "$DOCS" && ls -1 *.html 2>/dev/null || true) | grep -vx 'index.html' | sort )

TOTAL=$COUNT
if [ "$COUNT" -gt 0 ]; then
  TOPGRID="    <div class=\"grid\">
${CARDS}    </div>
"
else
  TOPGRID=""   # every plan lives in a subfolder; only the grouped sections render
fi

# ---- subfolder groups: each subdirectory of docs/ becomes its own sub-index ----
# (the top-level loop above only scans docs/*.html, so nested folders such as
#  docs/previews/<name>/ are listed here as separate, labelled card lists.)
SECTIONS=""
while IFS= read -r d; do
  [ -n "$d" ] || continue
  rel="${d#"$DOCS"/}"
  subfiles=$( (cd "$d" && ls -1 *.html 2>/dev/null || true) | grep -vx 'index.html' | sort || true )
  [ -n "$subfiles" ] || continue
  name=$(basename "$rel")
  pretty=$(printf '%s' "$name" | sed 's/[-_]/ /g' | awk '{for(i=1;i<=NF;i++)$i=toupper(substr($i,1,1)) substr($i,2)}1')
  case "$name" in openstation) pretty="OpenStation" ;; esac   # brand casing the generic title-caser can't know
  if [ -f "$d/index.html" ]; then
    heading="<a href=\"./${rel}/index.html\">${pretty}</a>"
  else
    heading="${pretty}"
  fi
  SUB=""
  while IFS= read -r sf; do
    [ -n "$sf" ] || continue
    stitle=$(grep -o '<title>[^<]*</title>' "$d/$sf" | head -1 | sed 's/<[^>]*>//g; s/^[[:space:]]*//; s/[[:space:]]*$//')
    [ -n "$stitle" ] || stitle="$sf"
    sbytes=$(wc -c < "$d/$sf")
    skb=$(( (sbytes + 1023) / 1024 ))
    sdate=$(git log -1 --format=%ad --date=short -- "$d/$sf" 2>/dev/null || true)
    [ -n "$sdate" ] || sdate=$(date '+%Y-%m-%d')
    TOTAL=$((TOTAL + 1))
    SUB+="      <a class=\"card\" href=\"./${rel}/${sf}\">
        <div class=\"ct\">${stitle}</div>
        <div class=\"cf\">${rel}/${sf}</div>
        <div class=\"cm\">${skb} KB &middot; ${sdate}</div>
        <span class=\"go\">Open &#8599;</span>
      </a>
"
  done <<< "$subfiles"
  SECTIONS+="    <section class=\"group\" data-group=\"${rel}\">
      <h2 class=\"group-title\" role=\"button\" tabindex=\"0\" aria-expanded=\"true\">
        <span class=\"group-caret\" aria-hidden=\"true\"><svg viewBox=\"0 0 24 24\" width=\"15\" height=\"15\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" focusable=\"false\"><path d=\"M5.5 9.25 12 15.75 18.5 9.25\"></path></svg></span>${heading} <span class=\"group-path\">${rel}/</span>
      </h2>
      <div class=\"grid\">
${SUB}      </div>
    </section>
"
done < <( find "$DOCS" -mindepth 1 -type d | sort )

cat > "$DOCS/index.html" <<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Plans &mdash; index</title>
<style>
  :root{--ink:#0c1322;--paper:#f7f8fb;--card:#fff;--line:#e3e7ef;--text:#1e2533;--muted:#5b6679;--accent:#2f6df6;--accent2:#0fb5a8;
        --mono:"SF Mono",ui-monospace,Menlo,Consolas,monospace;--sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif;}
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--text);font-family:var(--sans);line-height:1.6;-webkit-font-smoothing:antialiased}
  header{padding:64px 24px 40px;color:#fff;text-align:center;
    background:radial-gradient(900px 420px at 80% -20%,rgba(15,181,168,.28),transparent 60%),
               radial-gradient(700px 420px at 10% 0%,rgba(47,109,246,.30),transparent 55%),
               linear-gradient(135deg,#0b1220,#142036),#0b1220;}
  header .eyebrow{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#7fe3da;font-weight:600;margin-bottom:10px}
  header h1{margin:0;font-size:40px;font-weight:800;letter-spacing:-.5px}
  header p{margin:10px 0 0;color:#c4cfe4;font-size:16px}
  main{max-width:880px;margin:0 auto;padding:34px 22px 90px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:16px}
  .card{display:block;position:relative;background:var(--card);border:1px solid var(--line);border-radius:14px;
    padding:20px 22px 18px;text-decoration:none;color:inherit;box-shadow:0 1px 2px rgba(16,24,40,.05);
    transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease}
  .card:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(16,24,40,.10);border-color:#c7d3ec}
  .ct{font-size:17px;font-weight:700;color:var(--ink);padding-right:60px;line-height:1.3}
  .cf{font-family:var(--mono);font-size:11.5px;color:var(--accent);margin-top:8px;word-break:break-all}
  .cm{font-size:12.5px;color:var(--muted);margin-top:8px}
  .go{position:absolute;top:18px;right:18px;font-size:12px;font-weight:700;color:var(--accent2);
    background:#eafaf8;border:1px solid #b7e7e1;border-radius:999px;padding:3px 10px}
  .empty{color:var(--muted);text-align:center;padding:40px}
  .group{margin-top:8px}
  .group-title{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:44px 0 16px;padding-top:26px;
    border-top:1px solid var(--line);font-size:18px;font-weight:800;color:var(--ink);letter-spacing:-.2px;
    cursor:pointer;user-select:none;border-radius:4px}
  .group-title:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
  .group-title a{color:var(--ink);text-decoration:none}
  .group-title a:hover{color:var(--accent);text-decoration:underline}
  .group-caret{display:inline-flex;align-items:center;justify-content:center;flex:none;
    width:30px;height:30px;margin-left:-3px;border-radius:50%;color:var(--accent);
    background:rgba(47,109,246,.10);transition:background-color .15s ease,color .15s ease}
  .group-caret svg{display:block;transition:transform .22s cubic-bezier(.4,0,.2,1)}
  .group-title:hover .group-caret{background:rgba(47,109,246,.19);color:#1b56d8}
  .group.collapsed .group-caret svg{transform:rotate(-90deg)}
  .group.collapsed .grid{display:none}
  .group-path{font-family:var(--mono);font-size:11.5px;font-weight:600;color:var(--accent);letter-spacing:0}
  footer{max-width:880px;margin:0 auto;padding:0 22px 60px;color:var(--muted);font-size:12.5px;text-align:center}
  @media(max-width:560px){header h1{font-size:30px}.grid{grid-template-columns:1fr}}
</style>
</head>
<body>
  <header>
    <div class="eyebrow">wairehouse &middot; plans &amp; specs</div>
    <h1>Plans</h1>
    <p>Tap any card to open it &mdash; works great on mobile, diagrams zoom.</p>
  </header>
  <main>
${TOPGRID}${SECTIONS}  </main>
  <footer>${TOTAL} document(s) &middot; auto-generated index &middot; <a href="${PAGES_URL}">${PAGES_URL}</a></footer>
  <script>
  (function () {
    'use strict';
    var STORAGE_KEY = 'wairehouse-docs-collapsed-groups';
    var collapsed;
    try {
      collapsed = new Set(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]'));
    } catch (e) {
      collapsed = new Set();
    }

    function save() {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(collapsed)));
      } catch (e) { /* private browsing or storage disabled: state just won't persist */ }
    }

    function setState(section, title, isCollapsed) {
      section.classList.toggle('collapsed', isCollapsed);
      title.setAttribute('aria-expanded', String(!isCollapsed));
    }

    var sections = document.querySelectorAll('section.group[data-group]');
    for (var i = 0; i < sections.length; i++) {
      (function (section) {
        var name = section.getAttribute('data-group');
        var title = section.querySelector('.group-title');
        if (!title) return;

        setState(section, title, collapsed.has(name));

        function toggle() {
          var isCollapsed = !section.classList.contains('collapsed');
          setState(section, title, isCollapsed);
          if (isCollapsed) { collapsed.add(name); } else { collapsed.delete(name); }
          save();
        }

        title.addEventListener('click', function (e) {
          if (e.target.closest('a')) return; // clicking the heading link navigates instead of toggling
          toggle();
        });
        title.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            toggle();
          }
        });
      })(sections[i]);
    }
  })();
  </script>
</body>
</html>
HTML

echo "Wrote ${DOCS}/index.html with ${TOTAL} document(s)."
