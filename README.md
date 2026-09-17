# wairehouse

Stores ideas, specs, brainstorms, and plans produced with AI agents.

## 📋 Plans index

All rendered HTML plans live here — mobile-friendly, with zoomable diagrams:

### 👉 https://epeicher.github.io/wairehouse/

Served by GitHub Pages from the [`docs/`](docs/) folder.

## Repository layout

| Path | What it holds |
|------|---------------|
| [`docs/`](docs/) | Self-contained HTML plans + an auto-generated `index.html`. Published via GitHub Pages. |
| Project folders (e.g. [`openstation/`](openstation/), [`reprint/`](reprint/)) | Markdown plans, specs, brainstorms, and investigations about a specific project or repo. |
| [`skills/`](skills/) | Agent skills collected from around the web, kept here until they find a proper home. |
| [`build-docs-index.sh`](build-docs-index.sh) | Rebuilds `docs/index.html` from each file's `<title>`. |
| [`.github/workflows/pages.yml`](.github/workflows/pages.yml) | Rebuilds the index and deploys `docs/` to GitHub Pages on every push to `docs/`. |

## Adding a plan

Drop an `.html` file into the project's subfolder under `docs/` (`docs/openstation/`,
`docs/reprint/`, or a new one — each subfolder becomes its own section in the index), either way:

- **GitHub web UI** — *Add file → Upload files* into `docs/<project>/`, or
- **Git:**
  ```bash
  cp my-plan.html docs/openstation/
  git add docs/openstation/my-plan.html && git commit -m "Add my-plan" && git push
  ```

The **Build and deploy /docs to Pages** Action then regenerates the index and publishes
the site in a single run — no filenames to remember, and `docs/index.html` is never
committed. To preview the index locally, run `bash build-docs-index.sh`.
