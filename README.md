# peepshow marketing site

Static single-page marketing site — served at <https://www.peepshow.dev/> (CNAME on the
`t0mtaylor/peepshow` gh-pages branch).

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

## Hero reels — optional full showcase

The landing page hero animates CC-licensed sample clips with frames,
audio waveform, and (where available) a short transcript rotating
underneath. Rebuild the assets with:

```bash
node scripts/build-reels.mjs              # only downloads / extracts when cache is stale
FORCE_REELS=1 node scripts/build-reels.mjs # force regeneration
```

What you get depends on the build host:

| Tool                         | Install                            | Artefacts produced                        |
| :--------------------------- | :--------------------------------- | :---------------------------------------- |
| `ffmpeg` (required)          | `brew install ffmpeg`              | `f1..f6.webp` frames, `clip.mp4` (trimmed to 12 s with AAC audio preserved), `audio-waveform.svg` |
| `whisper-cli` (optional)     | `brew install whisper-cpp` (macOS), `scoop install whisper-cpp` (Windows), prebuilt [Linux releases](https://github.com/ggml-org/whisper.cpp/releases) | `transcript.json` — 6 segments max from the first 12 s |

**Model auto-download.** The build script fetches `ggml-base.en.bin`
(~148 MB) from [ggerganov/whisper.cpp on Hugging Face](https://huggingface.co/ggerganov/whisper.cpp/tree/main)
into `~/.peepshow/whisper-models/` on first run. Override the cache
directory with `PEEPSHOW_WHISPER_MODEL_DIR` and the model name with
`PEEPSHOW_TRANSCRIBE_MODEL` (e.g. `tiny.en` for a 77 MB alternative or
`large-v3` for ~3 GB + much better accuracy).

**Source clips.** The reels array in `scripts/build-reels.mjs` points
at Blender Foundation official trailers (Big Buck Bunny + Sintel —
both carry audio), three format variants of the NASA Earth-at-Night
clip (silent — included to exercise the no-audio code path), and the
NHK Jellyfish 10 s sample (also silent). The clip downloader trims
each source to 12 s with `ffmpeg -t 12` so the hero strip stays
lightweight; the audio extraction + transcription still runs against
the full source, giving richer transcripts than 12 s would yield.

Without `whisper-cli` the build still produces frames + waveforms; the
transcript ribbon stays hidden on the page. Use `PEEPSHOW_WHISPER_CPP`
to point at a specific binary.

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
