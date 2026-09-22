# Space Pixl

Reclaim storage by re-encoding a photo library with the [PIXL engine](https://github.com/xuckless/pixl-engine).
Electron + React + TypeScript, built with electron-vite and shipped with electron-builder.

This repository is public; the engine is not. The engine is a private Rust crate and this
app never sees its source: it depends on the compiled Node binding `@xuckless/pixl-engine`,
published to GitHub Packages by the engine's own release pipeline. That package is private
too, so installing the dependencies needs a `read:packages` token for it (see _Develop_);
without one the app cannot be built from this source. The binding runs inside an Electron
utility process so an engine crash restarts the worker instead of taking the app down.

## Layout

```
src/main/index.ts            app entry: window, store, engine client, IPC, updater
src/main/ipc.ts              every renderer-facing handler; results are { ok } | { ok: false, error }
src/main/pipeline.ts         the app's three calls over the engine's four: inspect · preview · convert
src/main/db.ts               the SQLite store (node:sqlite, no native module): conversions + inspections
src/main/engine/host.ts      runs in utilityProcess; loads @xuckless/pixl-engine, or the placeholder
src/main/engine/mock.ts      the development placeholder engine (dev builds only, never packaged)
src/main/engine/client.ts    main-side: spawns/restarts the host, promises over messages
src/main/updater.ts          electron-updater wiring, channel setting, IPC
src/main/settings.ts         the one settings file (update channel) in userData
src/preload/index.ts         contextBridge → window.spacePixl.{app,updates,files,engine,stats}
src/shared/engine-types.ts   the engine's request/report model in its serde shape (typed, complete)
src/shared/plan.ts           the app's dials as a flat Plan, and Plan → ConvertRequest
src/shared/recommend.ts      the decision layer: which conversions to offer and which to lead with
src/shared/ipc.ts            channel names and the result types both sides share
src/renderer/src/pages/      Optimise (analyse → recommend → dials → preview → convert) · Stats · Settings
src/renderer/src/components/ AnalysisPanel · RecommendationPanel · DialsPanel · PreviewPanel · charts · ui
tests/                       node --test over the pure modules (plan, recommend, db, mock)
electron-builder.yml         packaging, signing, notarization, update feed
.github/workflows/           ci · release-please · release · bump-engine
```

## How a conversion happens

The engine makes no decisions, so every decision is in this repo and can be read:

1. **inspect** — `probe` (what is this file), `analyze` (what do its pixels look like),
   `suggestEncode` (how was it encoded), then `recommend()` turns those into a verdict
   and ranked candidates with expected savings taken from the engine README's measurements
   (JPEG→JXL repack −19% and reversible, AVIF q60 −68%, HEIC +20%, PNG under 5 MB not worth
   it, RAW→DNG −14%, …). The source is also rendered to a fit-to-screen PNG for the preview.
2. **preview** — every dial change re-runs the _real_ encode to a temp file, then decodes that
   output back to PNG. The size shown is the file's size; the "after" image is the encoded pixels.
3. **convert** — the same encode beside the original (`IMG_0042.jxl` next to `IMG_0042.jpg`,
   never overwriting, the original untouched) and a row in the store.

The dials cover the whole converter surface: every encoder knob, resize + resampler,
depth/channels, metadata carry-over, colour policy (Preserve / Assign / ConvertTo / ToneMap),
RAW development and dither. Grading (white balance, exposure, curves…) is deliberately
absent — that belongs to a separate app.

## The placeholder engine

`@xuckless/pixl-engine` ships macOS and Windows binaries only. In development on any
other platform without a locally built binding (see _Linux_ below) the host falls back
to `src/main/engine/mock.ts`: it reads real JPEG/PNG/WebP
headers, synthesises pixel statistics, estimates output sizes from the README ratios, and
refuses what the shipped engine refuses (HEIC → `EncoderUnavailable`). Everything it
produces is flagged in the UI and in the store (`engine = 'mock'`). A packaged build never
uses it: `SPACE_PIXL_ENGINE` is `native` (default when packaged), `auto` (default in
`pnpm dev`) or `mock`.

## The store

`userData/space-pixl.db`, opened with Node's built-in `node:sqlite` (nothing to rebuild for
Electron). Two tables, `conversions` and `inspections`; the Stats page is one `summary()`
over them. A server-side store may come later; the `Store` class is the seam.

## Develop

```sh
pnpm config set //npm.pkg.github.com/:_authToken <PAT with read:packages>   # for @xuckless/pixl-engine (user-level; pnpm ignores ${ENV} in the project .npmrc)
pnpm install
pnpm dev            # electron-vite dev with HMR
pnpm typecheck && pnpm lint && pnpm test
pnpm build:unpack   # unpacked app in dist/ for a local look
```

If `pnpm dev` fails with `Error: Electron uninstall`, the `electron` package has no binary
under `node_modules` (its postinstall was skipped, for instance by an install run with
`ELECTRON_SKIP_BINARY_DOWNLOAD=1`). Fetch it with `node node_modules/electron/install.js`;
`pnpm rebuild electron` will not, since pnpm considers the package already built.

### Linux

Nothing is published for Linux; it is a development target only. `pnpm dev` runs with the
placeholder engine unless a Linux build of the binding is placed beside the installed
`@xuckless/pixl-engine`, where its loader looks first. `pnpm exec electron-builder --linux --x64`
then packages an AppImage into `dist/` (needs `libfuse.so.2` to run, or
`--appimage-extract-and-run`); `dist/linux-unpacked/space-pixl` runs directly.

### Native addon packaging

The binding is `@xuckless/pixl-engine` plus one optional platform package per target
(`-darwin-arm64`, `-darwin-x64`, `-win32-x64-msvc`) holding the `.node` file.
electron-builder installs only the platform package matching `--arch`, and
`asarUnpack` keeps every `.node` outside the asar so the utility process can load it.
Each per-arch build therefore carries exactly one engine binary.

## Release flow

1. Commit to `main` with [conventional commits](https://www.conventionalcommits.org)
   (`feat:`, `fix:`, `perf:`…). `feat` bumps minor, `fix` bumps patch while pre-1.0.
2. `release-please` keeps a release PR open with the next version and CHANGELOG.
3. Merging that PR tags `vX.Y.Z` and creates the GitHub release, then `release.yml`
   builds macOS arm64, macOS x64 and Windows x64 on GitHub-hosted runners (`macos-15`,
   `macos-15-intel`, `windows-latest`), signs and notarizes macOS when the secrets exist,
   and attaches installers plus `latest*.yml` / `beta*.yml` manifests to that release.
4. Installed apps check the releases on launch and every 4 hours, download in the
   background, and install on quit or when the user clicks _Restart to update_.

**Channels.** The channel is derived from the version: `0.3.0` publishes to `latest`,
`0.3.0-beta.1` publishes to `beta`. Users on _Stable_ never see prereleases. To cut a
beta, set `"prerelease": true` and a `prerelease-type` in `release-please-config.json`
on a release branch, or run `release.yml` by hand on a `v0.3.0-beta.1` tag.

**Engine updates.** The engine's release workflow publishes the npm package, then
sends this repo a `repository_dispatch` (`pixl-engine-released`). `bump-engine.yml`
opens a `fix(engine): bump pixl-engine to X` PR. Merge it and release-please cuts a
patch release carrying the new engine. Nothing ships automatically without that merge.

**Manual build.** _Actions → Release → Run workflow_ with a tag name. The workflow sets
`EP_GH_IGNORE_TIME` so electron-builder also uploads to a release published more than two
hours earlier; assets that already exist on the release are overwritten.

**CI.** Every job runs on GitHub-hosted runners. Pull requests from forks do not run CI:
the workflow skips them and the repository requires approval for external contributors,
since the private engine package could not be installed there anyway.

## Secrets and variables

Set in _Settings → Secrets and variables → Actions_.

| Name                          | Kind                            | Purpose                                                                                                                                                                            |
| ----------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PACKAGES_TOKEN`              | secret                          | classic PAT with `read:packages` for `@xuckless/pixl-engine` (GitHub forbids secret names starting with `GITHUB_`; workflows hand it to `actions/setup-node` as `NODE_AUTH_TOKEN`) |
| `RELEASE_PLEASE_TOKEN`        | secret (optional)               | PAT with `repo` + `workflow`; without it release-please and the bump PR use `GITHUB_TOKEN` and their PRs carry no CI checks                                                        |
| `CSC_LINK`                    | secret (optional until signing) | base64 of the Developer ID Application `.p12`; unsigned build when absent                                                                                                          |
| `CSC_KEY_PASSWORD`            | secret                          | password of that `.p12`                                                                                                                                                            |
| `APPLE_ID`                    | secret                          | Apple ID used for notarization                                                                                                                                                     |
| `APPLE_APP_SPECIFIC_PASSWORD` | secret                          | app-specific password for that Apple ID                                                                                                                                            |
| `APPLE_TEAM_ID`               | secret                          | 10-character team id                                                                                                                                                               |
| `WIN_CSC_LINK`                | secret (optional)               | base64 of a Windows code-signing `.pfx`; unsigned when absent                                                                                                                      |
| `WIN_CSC_KEY_PASSWORD`        | secret (optional)               | its password                                                                                                                                                                       |

Release assets: `release.yml` uploads with the workflow's own `GITHUB_TOKEN` (it has
`contents: write`) to the release that release-please published for the tag, which is why
`publish` in `electron-builder.yml` is the `github` provider with `releaseType: release`.
The repository is public, so installed apps read the releases without any token.

macOS auto-update only works on signed, notarized builds; Squirrel.Mac refuses anything
else. Windows updates work unsigned but SmartScreen warns until a certificate is added.

## Testing the updater from a dev build

```sh
SPACE_PIXL_FORCE_UPDATER=1 pnpm dev   # reads the feed named in dev-app-update.yml
```
