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
| [`desktop-mode/`](desktop-mode/) | Markdown plans, specs, and brainstorms. |
| [`build-docs-index.sh`](build-docs-index.sh) | Rebuilds `docs/index.html` from each file's `<title>`. |
| [`.github/workflows/build-index.yml`](.github/workflows/build-index.yml) | Rebuilds the index automatically on every push to `docs/`. |

## Adding a plan

Drop an `.html` file into `docs/`, either way:

- **GitHub web UI** — *Add file → Upload files* into `docs/`, or
- **Git:**
  ```bash
  cp my-plan.html docs/
  git add docs/my-plan.html && git commit -m "Add my-plan" && git push
  ```

The **Build /docs plans index** Action then regenerates the index automatically —
no filenames to remember. To rebuild it locally instead, run `bash build-docs-index.sh`.
