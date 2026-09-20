# Space Pixl

Reclaim storage by re-encoding a photo library with the [PIXL engine](https://github.com/xuckless/pixl-engine).
Electron + React + TypeScript, built with electron-vite and shipped with electron-builder.

The engine is a private Rust crate. This app never sees its source: it depends on the
compiled Node binding `@xuckless/pixl-engine`, published to GitHub Packages by the
engine's own release pipeline. The binding runs inside an Electron utility process so an
engine crash restarts the worker instead of taking the app down.

## Layout

```
src/main/index.ts          app entry: window, IPC, engine client, updater
src/main/updater.ts        electron-updater wiring, channel setting, IPC
src/main/settings.ts       the one settings file (update channel) in userData
src/main/engine/host.ts    runs in utilityProcess; loads @xuckless/pixl-engine by name
src/main/engine/client.ts  main-side: spawns/restarts the host, promises over messages
src/main/engine/ipc.ts     renderer-facing engine IPC (status, probe, pick-and-probe)
src/preload/index.ts       contextBridge → window.spacePixl.{app,updates,engine}
src/renderer/              React UI
src/shared/ipc.ts          channel names and the state types both sides share
src/shared/engine-types.ts loose types for the engine's serde values (TODO: real ones)
electron-builder.yml       packaging, signing, notarization, update feed
dev-app-update.yml         update feed for running unpackaged (SPACE_PIXL_FORCE_UPDATER=1)
.github/workflows/         ci · release-please · release · bump-engine
```

## Develop

```sh
pnpm config set //npm.pkg.github.com/:_authToken <PAT with read:packages>   # for @xuckless/pixl-engine (user-level; pnpm ignores ${ENV} in the project .npmrc)
pnpm install
pnpm dev            # electron-vite dev with HMR
pnpm typecheck && pnpm lint
pnpm build:unpack   # unpacked app in dist/ for a local look
```

Until `@xuckless/pixl-engine` is published the app runs without it and the Engine card
shows "Unavailable". Add the dependency with
`pnpm add @xuckless/pixl-engine` once it exists; nothing else changes.

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
   builds macOS arm64, macOS x64 and Windows x64, signs and notarizes macOS, and
   uploads installers plus `latest*.yml` / `beta*.yml` manifests to the S3 bucket.
4. Installed apps check the bucket on launch and every 4 hours, download in the
   background, and install on quit or when the user clicks _Restart to update_.

**Channels.** The channel is derived from the version: `0.3.0` publishes to `latest`,
`0.3.0-beta.1` publishes to `beta`. Users on _Stable_ never see prereleases. To cut a
beta, set `"prerelease": true` and a `prerelease-type` in `release-please-config.json`
on a release branch, or run `release.yml` by hand on a `v0.3.0-beta.1` tag.

**Engine updates.** The engine's release workflow publishes the npm package, then
sends this repo a `repository_dispatch` (`pixl-engine-released`). `bump-engine.yml`
opens a `fix(engine): bump pixl-engine to X` PR. Merge it and release-please cuts a
patch release carrying the new engine. Nothing ships automatically without that merge.

**Manual build.** _Actions → Release → Run workflow_ with a tag name.

## Secrets and variables

Set in _Settings → Secrets and variables → Actions_.

| Name                          | Kind                            | Purpose                                                                                                                                                                            |
| ----------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PACKAGES_TOKEN`              | secret                          | classic PAT with `read:packages` for `@xuckless/pixl-engine` (GitHub forbids secret names starting with `GITHUB_`; workflows hand it to `actions/setup-node` as `NODE_AUTH_TOKEN`) |
| `RELEASE_PLEASE_TOKEN`        | secret (optional)               | PAT with `repo` + `workflow`; without it release-please and the bump PR use `GITHUB_TOKEN` and their PRs carry no CI checks                                                        |
| `AWS_ACCESS_KEY_ID`           | secret                          | IDrive e2 access key (S3-compatible)                                                                                                                                               |
| `AWS_SECRET_ACCESS_KEY`       | secret                          | IDrive e2 secret key                                                                                                                                                               |
| (bucket)                      | —                               | named directly in `electron-builder.yml` and `dev-app-update.yml` (`shipment`); electron-builder cannot read it from the environment                                               |
| `CSC_LINK`                    | secret (optional until signing) | base64 of the Developer ID Application `.p12`; unsigned build when absent                                                                                                          |
| `CSC_KEY_PASSWORD`            | secret                          | password of that `.p12`                                                                                                                                                            |
| `APPLE_ID`                    | secret                          | Apple ID used for notarization                                                                                                                                                     |
| `APPLE_APP_SPECIFIC_PASSWORD` | secret                          | app-specific password for that Apple ID                                                                                                                                            |
| `APPLE_TEAM_ID`               | secret                          | 10-character team id                                                                                                                                                               |
| `WIN_CSC_LINK`                | secret (optional)               | base64 of a Windows code-signing `.pfx`; unsigned when absent                                                                                                                      |
| `WIN_CSC_KEY_PASSWORD`        | secret (optional)               | its password                                                                                                                                                                       |

Bucket requirements: objects under `space-pixl/` must be publicly readable (the
publisher sets `public-read`; the bucket's own policy must allow it), and the
virtual-hosted URL `https://<bucket>.s3.us-midwest-1.idrivee2.com` must resolve. If it
does not, enable `forcePathStyle: true` in `electron-builder.yml` and `dev-app-update.yml`.

macOS auto-update only works on signed, notarized builds; Squirrel.Mac refuses anything
else. Windows updates work unsigned but SmartScreen warns until a certificate is added.

## Testing the updater from a dev build

```sh
# fill in the bucket in dev-app-update.yml first
SPACE_PIXL_FORCE_UPDATER=1 pnpm dev
```
