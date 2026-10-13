// Renders every openstation/experiments/<name>/ that has a README.md into
// docs/openstation/experiments/<name>.html: the README, plus each task's
// prompt.md and rubric.md from tasks/<task>/ (tasks/aborted/ is skipped).
// Raw run data (results/, logs) is never read.
//
// Run from anywhere:   node openstation/experiments/build-html.mjs
// (The Pages workflow runs it before build-docs-index.sh on every deploy, so
//  the output is not committed; see .github/workflows/pages.yml.)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const outDir = path.join(root, 'docs/openstation/experiments');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const slug = (s) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function inline(s) {
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/±/g, '<span class="pm">±</span>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[+i])}</code>`);
}

// Small Markdown subset: headings, paragraphs, flat lists, blockquotes,
// fenced code, bare {...} JSON blocks, pipe tables.
function md(text, { headingShift = 0, toc = null } = {}) {
  const lines = text.replace(/\r/g, '').split('\n');
  const html = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith('```')) {
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      i++;
      html.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }
    if (line === '{') {
      const buf = [];
      while (i < lines.length) { buf.push(lines[i]); if (lines[i++] === '}') break; }
      html.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = Math.min(6, h[1].length + headingShift);
      const body = inline(h[2]);
      const id = slug(h[2]);
      if (toc && level <= 3) toc.push({ level, id, text: h[2].replace(/`/g, '') });
      html.push(`<h${level} id="${id}">${body}</h${level}>`);
      i++;
      continue;
    }
    if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(2).map(cells);
      html.push('<div class="table-wrap"><table><thead><tr>' + head.map((c) => `<th>${inline(c)}</th>`).join('') +
        '</tr></thead><tbody>' + body.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
        '</tbody></table></div>');
      continue;
    }
    if (line.startsWith('>')) {
      const buf = [];
      while (i < lines.length && lines[i].startsWith('>')) buf.push(lines[i++].replace(/^>\s?/, ''));
      html.push(`<blockquote><p>${inline(buf.join(' '))}</p></blockquote>`);
      continue;
    }
    if (/^- /.test(line)) {
      const items = [];
      while (i < lines.length && (/^- /.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) {
        if (/^- /.test(lines[i])) items.push(lines[i].slice(2));
        else items[items.length - 1] += ' ' + lines[i].trim();
        i++;
      }
      html.push('<ul>' + items.map((t) => `<li>${inline(t)}</li>`).join('') + '</ul>');
      continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#|\||>|- |```)/.test(lines[i]) && lines[i] !== '{') buf.push(lines[i++]);
    html.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return html.join('\n');
}

function render(name) {
  const src = path.join(here, name);
  const out = path.join(outDir, `${name}.html`);
  const read = (p) => fs.readFileSync(path.join(src, p), 'utf8');

  const toc = [];
  let readme = read('README.md');
  const titleLine = readme.split('\n')[0].replace(/^#\s+/, '');
  readme = readme.split('\n').slice(1).join('\n');
  // Give the intro (everything before the first ## heading) its own heading.
  readme = '## How it works\n' + readme;
  const readmeHtml = md(readme, { toc });

  const tasksDir = path.join(src, 'tasks');
  const tasks = (fs.existsSync(tasksDir) ? fs.readdirSync(tasksDir) : [])
    .filter((t) => t !== 'aborted' && fs.existsSync(path.join(tasksDir, t, 'prompt.md')))
    .sort();
  let tasksHtml = '';
  if (tasks.length) {
    toc.push({ level: 2, id: 'tasks', text: 'Appendix: task prompts and rubrics' });
    tasksHtml = `<h2 id="tasks">Appendix: task prompts and rubrics</h2>
  <p>Every task under <code>tasks/</code>. The judge sees the rubric; the agent sees only the prompt.</p>
  ` + tasks.map((t) => {
      const prompt = read(`tasks/${t}/prompt.md`);
      const rubricRaw = fs.existsSync(path.join(tasksDir, t, 'rubric.md')) ? read(`tasks/${t}/rubric.md`) : '';
      // Rubric H1 reads: # Judge rubric: "Keep on top" task
      const label = (rubricRaw.match(/^#[^\n"]*"([^"\n]+)"/) || [])[1] || t;
      const max = (rubricRaw.match(/"max":\s*(\d+)/) || [])[1];
      const rubric = rubricRaw.split('\n').slice(1).join('\n'); // drop its H1
      toc.push({ level: 3, id: `task-${t}`, text: label });
      return `<h3 id="task-${t}">${esc(label)} <span class="tag">tasks/${t}/</span></h3>
  <p class="label">Prompt the agent received</p>
  ${md(prompt)}
  ${rubric ? `<details><summary>Judge rubric${max ? ` (max ${max})` : ''}</summary><div class="rubric">${md(rubric, { headingShift: 2 })}</div></details>` : ''}`;
    }).join('\n');
}

const tocHtml = toc.map((e) => `<a class="l${e.level}" href="#${e.id}">${esc(e.text)}</a>`).join('\n');

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Experiment — ${esc(titleLine.split(':')[0])}: ${esc(titleLine.split(':').slice(1).join(':').trim())}</title>
<style>
  :root{--ink:#0c1322;--paper:#f7f8fb;--card:#fff;--line:#e3e7ef;--text:#1e2533;--muted:#5b6679;--accent:#2f6df6;--accent-2:#0fb5a8;
    --code-bg:#0e1626;--code-text:#d7e0f4;--inline-bg:#eef2fa;--maxw:1180px;--sidew:260px;
    --mono:"SF Mono",ui-monospace,"JetBrains Mono",Menlo,Consolas,monospace;
    --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif;}
  @media (prefers-color-scheme: dark){:root{--ink:#eef2fb;--paper:#0b111d;--card:#121a2a;--line:#243049;--text:#d9e0ee;--muted:#93a0b8;--accent:#79a3ff;--accent-2:#3fd6c9;--inline-bg:#1b2538}}
  *{box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{margin:0;background:var(--paper);color:var(--text);font-family:var(--sans);line-height:1.65;font-size:16px;-webkit-font-smoothing:antialiased}
  a{color:var(--accent);text-decoration:none} a:hover{text-decoration:underline}
  header{padding:56px 24px 36px;color:#fff;
    background:radial-gradient(900px 420px at 80% -20%,rgba(15,181,168,.28),transparent 60%),radial-gradient(700px 420px at 10% 0%,rgba(47,109,246,.30),transparent 55%),linear-gradient(135deg,#0b1220,#142036),#0b1220}
  header .in{max-width:var(--maxw);margin:0 auto}
  header .eyebrow{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#7fe3da;font-weight:600;margin-bottom:10px}
  header .eyebrow a{color:#7fe3da}
  header h1{margin:0;font-size:36px;line-height:1.2;font-weight:800;letter-spacing:-.5px;max-width:900px}
  header code{background:rgba(255,255,255,.1);color:#e6ecf7}
    header p{margin:12px 0 0;color:#c4cfe4;font-size:15px;max-width:780px}
  .shell{display:flex;gap:40px;max-width:var(--maxw);margin:0 auto;padding:0 24px}
  nav.toc{position:sticky;top:0;align-self:flex-start;width:var(--sidew);min-width:var(--sidew);max-height:100vh;overflow-y:auto;padding:30px 0 40px}
  nav.toc .h{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:700;margin-bottom:8px}
  nav.toc a{display:block;color:var(--muted);font-size:13.5px;padding:4px 0 4px 10px;border-left:2px solid var(--line);line-height:1.35}
  nav.toc a:hover{color:var(--accent);border-left-color:var(--accent);text-decoration:none}
  nav.toc a.l3{padding-left:22px;font-size:12.5px}
  main{flex:1;min-width:0;padding:22px 0 90px}
  h2{font-size:25px;color:var(--ink);margin:46px 0 14px;padding-top:22px;border-top:1px solid var(--line);letter-spacing:-.2px}
  main > h2:first-child{border-top:0;margin-top:10px}
  h3{font-size:19px;color:var(--ink);margin:32px 0 10px}
  h4{font-size:16px;color:var(--ink);margin:24px 0 8px} h5{font-size:15px;color:var(--ink);margin:20px 0 6px}
  p,li{max-width:76ch}
  code{font-family:var(--mono);font-size:.86em;background:var(--inline-bg);padding:1px 5px;border-radius:5px}
  pre{background:var(--code-bg);color:var(--code-text);padding:16px 18px;border-radius:12px;overflow-x:auto;font-size:13px;line-height:1.55}
  pre code{background:none;padding:0;font-size:inherit;color:inherit}
  blockquote{margin:14px 0;padding:10px 18px;border-left:3px solid var(--accent-2);background:var(--card);border-radius:0 10px 10px 0;color:var(--muted)}
  blockquote p{margin:0}
  .table-wrap{overflow-x:auto;margin:16px 0;border:1px solid var(--line);border-radius:12px;background:var(--card)}
  table{border-collapse:collapse;width:100%;font-size:14px}
  th,td{padding:9px 12px;text-align:left;border-bottom:1px solid var(--line);white-space:nowrap}
  td:first-child,th:first-child{white-space:normal;min-width:140px}
  th{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);background:var(--paper)}
  tbody tr:last-child td{border-bottom:0}
  .pm{color:var(--muted);font-size:.9em}
  .tag{font-family:var(--mono);font-size:12px;font-weight:600;color:var(--accent);margin-left:8px}
  .label{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:700;margin:14px 0 4px}
  details{margin:16px 0;border:1px solid var(--line);border-radius:12px;background:var(--card)}
  summary{cursor:pointer;padding:12px 16px;font-weight:700;color:var(--ink)}
  .rubric{padding:0 18px 12px}
  footer{max-width:var(--maxw);margin:0 auto;padding:0 24px 50px;color:var(--muted);font-size:12.5px}
  @media(max-width:900px){nav.toc{display:none}.shell{display:block;padding:0 16px}header{padding:40px 16px 28px}header h1{font-size:27px}}
</style>
</head>
<body>
<header><div class="in">
  <div class="eyebrow"><a href="../../index.html">wairehouse</a> &middot; OpenStation &middot; experiment</div>
  <h1>${inline(titleLine)}</h1>
  <p>Experiment notes from <code>openstation/experiments/${esc(name)}/</code>.</p>
</div></header>
<div class="shell">
  <nav class="toc"><div class="h">On this page</div>
${tocHtml}
  </nav>
  <main>
${readmeHtml}
${tasksHtml}
  </main>
</div>
<footer>Generated by <code>openstation/experiments/build-html.mjs</code> from <code>${esc(name)}/README.md</code> and <code>tasks/</code>. Raw run data (diffs, logs, scores) is not published.</footer>
</body>
</html>
`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(out, page);
console.log(`Wrote ${path.relative(root, out)} (${page.length} bytes)`);
}

for (const name of fs.readdirSync(here).sort()) {
  if (fs.existsSync(path.join(here, name, 'README.md'))) render(name);
}
