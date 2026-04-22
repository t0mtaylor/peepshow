# peepshow marketing site

Static single-page marketing site — served at <https://t0mtaylor.github.io/peepshow/>.

## Structure

```
site/
├── index.html        main page
├── 404.html          pretty 404
├── styles.css        all styles
├── robots.txt
├── sitemap.xml
├── .nojekyll         disables Jekyll on GitHub Pages
└── assets/
    ├── logo.svg
    └── og.png        social preview (Twitter/OpenGraph)
```

## Local preview

Any static server. Simplest:

```bash
cd site
python3 -m http.server 4000
# open http://localhost:4000
```

## Deploy

Automatic. Pushing changes under `site/` to `main` triggers [`.github/workflows/deploy-site.yml`](../.github/workflows/deploy-site.yml), which:

1. Clones `t0mtaylor/peepshow` using the `PUBLIC_REPO_PUSH_TOKEN` secret.
2. Checks out (or creates) the `gh-pages` branch.
3. Rsyncs `site/` over the branch contents.
4. Commits + pushes.

GitHub Pages must be enabled on `t0mtaylor/peepshow` → Settings → Pages → Source: **Deploy from a branch** → **gh-pages** / **/(root)**.

## Manual deploy

```bash
gh workflow run deploy-site.yml
```

## Secret required

`PUBLIC_REPO_PUSH_TOKEN` — a fine-grained PAT on the `t0mtaylor` user with **Contents: Read and write** on `t0mtaylor/peepshow` only. Add via Settings → Secrets and variables → Actions.
