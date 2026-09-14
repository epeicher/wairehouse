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
| [`.github/workflows/build-index.yml`](.github/workflows/build-index.yml) | Rebuilds the index automatically on every push to `docs/`. |

## Adding a plan

Drop an `.html` file into the project's subfolder under `docs/` (`docs/openstation/`,
`docs/reprint/`, or a new one — each subfolder becomes its own section in the index), either way:

- **GitHub web UI** — *Add file → Upload files* into `docs/<project>/`, or
- **Git:**
  ```bash
  cp my-plan.html docs/openstation/
  git add docs/openstation/my-plan.html && git commit -m "Add my-plan" && git push
  ```

The **Build /docs plans index** Action then regenerates the index automatically —
no filenames to remember. To rebuild it locally instead, run `bash build-docs-index.sh`.
